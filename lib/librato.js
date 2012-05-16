/*
 * Flushes stats to Librato Metrics (https://metrics.librato.com).
 *
 * To enable this backend, include 'statsd-librato-backend' in the
 * backends configuration array:
 *
 *   backends: ['statsd-librato-backend']
 *
 * The backend will read the configuration options from the following
 * 'librato' hash defined in the main statsd config file:
 *
 *  librato : {
 *    email : Email address of your Librato Metrics account (req'd)
 *    token : API Token of your Librato Metrics accounts    (req'd)
 *    source: Name of a source to use for metrics (optional)
 *    snapTime : Lock timestamps to this interval in seconds (optional)
 *    countersAsGauges: Boolean on whether or not all counters should be
 *                      reported as gauges, as was originally done with
 *                      Librato's statsd. Defaults to false which means
 *                      counters will be published as native Metrics
 *                      counters.
 *  }
 */

var   net = require('net'),
     util = require('util'),
url_parse = require('url').parse,
    https = require('https'),
     http = require('http'),
       fs = require('fs');

var debug;
var api, email, token, period, sourceName;

// How long to wait before retrying a failed post, in seconds
var retryDelay = 5;

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

// Statsd counters reset, we want monotonically increasing
// counters.
var libratoCounters = {};

var post_payload = function(options, proto, payload, retry)
{
  var req = proto.request(options, function(res) {
    // Retry 5xx codes
    if (Math.floor(res.statusCode / 100) == 5){
      res.on('data', function(d){
        var errdata = "HTTP " + res.statusCode + ": " + d;
        if (retry){
          if (debug) {
            util.log("Error sending metrics to Librato: " + errdata);
          }
          setTimeout(function() {
            post_payload(options, proto, payload, false);
          }, retryDelay * 1000);
        } else {
          util.log("Error connecting to Librato!\n" + errdata,"crit");
        }
      });
    }
    if (Math.floor(res.statusCode / 100) == 4){
      res.on('data', function(d){
        var errdata = "HTTP " + res.statusCode + ": " + d;
        if (debug) {
          util.log("Error sending metrics to Librato: " + errdata);
        }
      });
    }
  });

  req.write(payload);
  req.end();

  libratoStats['last_flush'] = Math.round(new Date().getTime() / 1000);
  req.on('error', function(errdata) {
    if (retry){
      setTimeout(function() {
        post_payload(options, proto, payload, false);
      }, retryDelay * 1000);
    } else {
      logger("Error connecting to Librato!\n" + errdata,"crit");
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

  var proto = http;
  if ((parsed_host["protocol"] || 'http:').match(/https/)) {
    proto = https;
  }

  post_payload(options, proto, payload, false);
};

var sanitize_name = function(name)
{
  return name.replace(/[^-.:_\w]+/, '_').substr(0,255)
};

var flush_stats = function librato_flush(ts, metrics)
{
  var numStats = 0, statCount;
  var key;
  var counters = [];
  var gauges = [];
  var measureTime = ts;

  if (snapTime) {
    measureTime = Math.floor(ts / snapTime) * snapTime;
  }

  var addMeasure = function add_measure(mType, measure) {
    if (mType == 'counter') {
      counters.push(measure);
    } else {
      gauges.push(measure);
    }

    numStats += 1;

    // Post measurements and clear arrays if past batch size
    if (counters.length + gauges.length >= maxBatchSize) {
      post_metrics(measureTime, gauges, counters);
      gauges = [];
      counters = [];
    }
  };

  for (key in metrics.counters) {
    if (countersAsGauges) {
      addMeasure('gauge', { name: sanitize_name(key),
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

    addMeasure('counter', { name: sanitize_name(key),
                            value: libratoCounters[key].value});
  }

  for (key in metrics.timers) {
    var count = metrics.timers[key].length;
    var min = null;
    var max = null;
    var sum = 0;
    var sumOfSquares = 0;

    if (count == 0) {
      continue;
    }

    for (var i = 0; i < metrics.timers[key].length; i++) {
      var val = metrics.timers[key][i];

      if (min == null || val < min) { min = val; }
      if (max == null || val > max) { max = val; }

      sum += val;
      sumOfSquares += val * val;
    }

    var gauge = {
      name: sanitize_name(key),
      count: count,
      sum: sum,
      sum_squares: sumOfSquares,
      min: min,
      max: max
    };

    addMeasure('gauge', gauge);
  }

  for (key in metrics.gauges) {
    addMeasure('gauge', { name: sanitize_name(key),
                          value: metrics.gauges[key]});
  }

  statCount = numStats;

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
    countersAsGauges = config.librato.countersAsGauges;
    snapTime = config.librato.snapTime;
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
