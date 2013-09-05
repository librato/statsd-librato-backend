/*
 * Flushes stats to Librato Metrics (https://metrics.librato.com).
 *
 * To enable this backend, include 'statsd-librato-backend' in the
 * backends configuration array:
 *
 *   backends: ['statsd-librato-backend']
 *
 * The backend will read the configuration options from the main
 * statsd configuration file under the sub-hash key 'librato'. See the
 * README in this repository for available configuration options.
 */

var   net = require('net'),
     util = require('util'),
url_parse = require('url').parse,
    https = require('https'),
     http = require('http'),
       fs = require('fs');
var tunnelAgent = null;
var debug;
var api, email, token, period, sourceName, sourceRegex;

// How long to wait before retrying a failed post, in seconds
var retryDelaySecs = 5;

// Timeout for POSTs, in seconds
var postTimeoutSecs = 4;

var libratoStats = {};
var userAgent;
var basicAuthHeader;
var flushInterval;

// Maximum measurements we send in a single post
var maxBatchSize = 500;

// What epoch interval to align time stamps to (defaults to flush interval)
var snapTime = null;

// Previous versions treated counters as gauges, support
// a legacy mode to let users transition.
var countersAsGauges = false;

// Do we skip publishing internal statsd metrics.
//
var skipInternalMetrics = true;

// Statsd counters reset, we want monotonically increasing
// counters.
var libratoCounters = {};

var post_payload = function(options, proto, payload, retry)
{
  var req = proto.request(options, function(res) {
    res.on('data', function(d) {
      // Retry 5xx codes
      if (Math.floor(res.statusCode / 100) == 5){
        var errdata = "HTTP " + res.statusCode + ": " + d;
        if (retry){
          if (debug) {
            util.log("Error sending metrics to Librato: " + errdata);
          }
          setTimeout(function() {
            post_payload(options, proto, payload, false);
          }, retryDelaySecs * 1000);
        } else {
          util.log("Error connecting to Librato!\n" + errdata,"crit");
        }
      }

      // Log 4xx errors
      if (Math.floor(res.statusCode / 100) == 4){
        var errdata = "HTTP " + res.statusCode + ": " + d;
        if (debug) {
          util.log("Error sending metrics to Librato: " + errdata);
        }
      }
    });
  });

  req.setTimeout(postTimeoutSecs * 1000, function(request) {
    if (debug) {
      util.log("Timed out sending metrics to Librato");
    }
    req.end();
  });

  req.write(payload);
  req.end();

  libratoStats['last_flush'] = Math.round(new Date().getTime() / 1000);
  req.on('error', function(errdata) {
    if (retry){
      setTimeout(function() {
        post_payload(options, proto, payload, false);
      }, retryDelaySecs * 1000);
    } else {
      util.log("Error connecting to Librato!\n" + errdata);
    }
  });
};

var post_metrics = function(ts, gauges, counters)
{
  var payload = {gauges: gauges,
                 counters: counters,
                 measure_time: ts};

  var parsed_host = url_parse(api || 'https://metrics-api.librato.com');

  if (sourceName) {
    payload.source = sourceName;
  }

  payload = JSON.stringify(payload);

  var options = {
    host: parsed_host["hostname"],
    port: parsed_host["port"] || 443,
    path: '/v1/metrics',
    method: 'POST',
    headers: {
      "Authorization": basicAuthHeader,
      "Content-Length": payload.length,
      "Content-Type": "application/json",
      "User-Agent" : userAgent
    }
 };

 if (tunnelAgent) {
   options["agent"] = tunnelAgent;
 }

  var proto = http;
  if ((parsed_host["protocol"] || 'http:').match(/https/)) {
    proto = https;
  }

  post_payload(options, proto, payload, true);
};

var sanitize_name = function(name)
{
  return name.replace(/[^-.:_\w]+/, '_').substr(0,255)
};

var timer_gauge_pct = function(timer_name, values, pct, suffix)
{
  var thresholdIndex = Math.round(((100 - pct) / 100) * values.length);
  var numInThreshold = values.length - thresholdIndex;

  if (numInThreshold <= 0) {
    return null;
  }

  var max = values[numInThreshold - 1];
  var min = values[0];

  var sum = 0;
  var sumOfSquares = 0;

  for (var i = 0; i < numInThreshold; i++) {
    sum += values[i];
    sumOfSquares += values[i] * values[i];
  }

  var name = timer_name;

  if (suffix) {
    name += suffix;
  }

  return {
    name: name,
    count: numInThreshold,
    sum: sum,
    sum_squares: sumOfSquares,
    min: min,
    max: max
  };
}

var flush_stats = function librato_flush(ts, metrics)
{
  var numStats = 0, statCount;
  var key;
  var counters = [];
  var gauges = [];
  var measureTime = ts;
  var internalStatsdRe = /^statsd\./;

  if (snapTime) {
    measureTime = Math.floor(ts / snapTime) * snapTime;
  }

  var addMeasure = function add_measure(mType, measure, countStat) {
    countStat = typeof countStat !== 'undefined' ? countStat : true;

    var match;
    if (sourceRegex && (match = measure.name.match(sourceRegex)) && match[1]) {
      // Use first capturing group as source name
      measure.source = sanitize_name(match[1]);
      // Remove entire matching string from the measure name
      measure.name = sanitize_name(measure.name.slice(0, match.index) + measure.name.slice(match.index + match[0].length));
    } else {
      measure.name = sanitize_name(measure.name);
    }

    if (mType == 'counter') {
      counters.push(measure);
    } else {
      gauges.push(measure);
    }

    if (countStat) {
      numStats += 1;
    }

    // Post measurements and clear arrays if past batch size
    if (counters.length + gauges.length >= maxBatchSize) {
      post_metrics(measureTime, gauges, counters);
      gauges = [];
      counters = [];
    }
  };

  for (key in metrics.counters) {
    if (skipInternalMetrics && (key.match(internalStatsdRe) != null)) {
      continue;
    }

    if (countersAsGauges) {
      addMeasure('gauge', { name: key,
                            value: metrics.counters[key]});
      continue;
    }

    if (!libratoCounters[key]) {
      libratoCounters[key] = {value: metrics.counters[key],
                              lastUpdate: ts};
    } else {
      libratoCounters[key].value += metrics.counters[key];
      libratoCounters[key].lastUpdate = ts;
    }

    addMeasure('counter', { name: key,
                            value: libratoCounters[key].value});
  }

  for (key in metrics.timers) {
    if (metrics.timers[key].length == 0) {
      continue;
    }
    if (skipInternalMetrics && (key.match(internalStatsdRe) != null)) {
      continue;
    }

    var sortedVals = metrics.timers[key].sort(
      function (a, b) { return a - b; }
    );

    // First build the 100% percentile
    var gauge = timer_gauge_pct(key, sortedVals, 100, null);

    if (gauge) {
      addMeasure('gauge', gauge);
    }

    // Now for each percentile
    var pKey;
    for (pKey in metrics.pctThreshold) {
      var pct = metrics.pctThreshold[pKey];

      gauge = timer_gauge_pct(key, sortedVals, pct, "." + pct);
      if (gauge) {
        // Percentiles are not counted in numStats
        addMeasure('gauge', gauge, false);
      }
    }
  }

  for (key in metrics.gauges) {
    if (skipInternalMetrics && (key.match(internalStatsdRe) != null)) {
      continue;
    }

    addMeasure('gauge', { name: key,
                          value: metrics.gauges[key]});
  }

  statCount = numStats;

  if (!skipInternalMetrics) {
    if (countersAsGauges) {
      addMeasure('gauge', { name: 'numStats',
                            value: statCount});
    } else {
      if (libratoCounters['numStats']) {
        libratoCounters['numStats'].value += statCount;
        libratoCounters['numStats'].lastUpdate = ts;
      } else {
        libratoCounters['numStats'] = {value: statCount,
                                       lastUpdate: ts};
      }

      addMeasure('counter', { name: 'numStats',
                              value: libratoCounters['numStats'].value});
    }
  }

  if (gauges.length > 0 || counters.length > 0) {
    post_metrics(measureTime, gauges, counters);
  }

  // Delete any counters that were not published, as they
  // were deleted.
  var toDelete = [];
  for (key in libratoCounters) {
    if (libratoCounters[key].lastUpdate == ts) {
      continue;
    }

    toDelete.push(key);
  }

  for (var i = 0; i < toDelete.length; i++) {
    delete libratoCounters[toDelete[i]];
  }
};

var backend_status = function librato_status(writeCb) {
  for (stat in libratoStats) {
    writeCb(null, 'librato', stat, libratoStats[stat]);
  }
};

var build_basic_auth = function(email, token)
{
  return 'Basic ' + new Buffer(email + ':' + token).toString('base64');
}

var build_user_agent = function()
{
  var str;
  var version = "unknown";

  try {
    str = fs.readFileSync(__dirname + '/../package.json', 'UTF-8');
    json = JSON.parse(str);
    version = json['version'];
  } catch (e) {
    if (debug) {
      util.log(e);
    }
  }

  return "statsd-librato-backend/" + version;
}

exports.init = function librato_init(startup_time, config, events)
{
  debug = config.debug;

  // Prefer config options nested under the top-level 'librato' hash
  if (config.librato) {
    api = config.librato.api;
    email = config.librato.email;
    token = config.librato.token;
    sourceName = config.librato.source;
    sourceRegex = config.librato.sourceRegex;
    countersAsGauges = config.librato.countersAsGauges;
    snapTime = config.librato.snapTime;
    skipInternalMetrics = config.librato.skipInternalMetrics;

    if (config.librato.proxy && config.librato.proxy.uri) {
      var tunnel;
      try {
        tunnel = require('tunnel');
      } catch (e) {
        util.log("Error cannot find module 'tunnel'.");
        util.log("Make sure to run `npm install tunnel`.");
        return false;
      }

      var uri_parsed = url_parse(config.librato.proxy.uri);
      var defaultPort, tunnelFunc;

      if (uri_parsed['protocol'] == 'https') {
        tunnelFunc = tunnel.httpsOverHttps;
        defaultPort = 443;
      } else {
        tunnelFunc = tunnel.httpsOverHttp;
        defaultPort = 80;
      }

      tunnelAgent = tunnelFunc({
        "proxy" : {
          "host" : uri_parsed['hostname'],
          "port" : uri_parsed['port'] || defaultPort
        }
      });
    }

    if (config.librato.retryDelaySecs) {
      retryDelaySecs = config.librato.retryDelaySecs;
    }

    if (config.librato.postTimeoutSecs) {
      postTimeoutSecs = config.librato.postTimeoutSecs;
    }

    if (config.librato.batchSize) {
      maxBatchSize = config.librato.batchSize;
    }
  } else {
    // XXX: Previous versions of the librato/statsd client would read
    // all configuration variables from the top-level of the configuration
    // file. Detect this and map them to the appropriate configuration
    // options.
    //
    api = config.libratoHost;
    email = config.libratoUser;
    token = config.libratoApiKey;
    sourceName = config.libratoSource;
    snapTime = config.libratoSnap;

    // Detected old configuration, provide least surprise for users by
    // sending counters in as gauges.
    countersAsGauges = true;
  }

  if (!email || !token) {
    util.log("Error: Invalid configuration for Librato Metrics backend");
    return false;
  }

  flushInterval = config.flushInterval;

  if (!snapTime) {
    snapTime = Math.floor(flushInterval / 1000);
  }

  userAgent = build_user_agent();
  basicAuthHeader = build_basic_auth(email, token);

  events.on('flush', flush_stats);
  events.on('status', backend_status);

  return true;
};
