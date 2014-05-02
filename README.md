# StatsD Librato Metrics backend

[![NPM version](https://badge.fury.io/js/statsd-librato-backend.svg)](http://badge.fury.io/js/statsd-librato-backend)

## Overview

This is a pluggable backend for [StatsD][statsd], which
publishes stats to [Librato Metrics](https://metrics.librato.com).

## Requirements

* [StatsD][statsd] versions >= 0.6.0.
* An active [Librato Metrics](https://metrics.librato.com/sign_up) account.

## Installation

    $ cd /path/to/statsd
    $ npm install statsd-librato-backend

## Configuration

You have to add the following basic configuration information to your
StatsD config file.

```js
{
  librato: {
    email:  "myemail@example.com",
    token:  "ca98e2bc23b1bfd0cbe9041e824f610491129bb952d52ca4ac22cf3eab5a1c32",
    source: "unique-per-statsd-instance"
  }
}
```

The *email* and *token* settings can be found on your Librato account
settings page. The *source* is an optional-but-recommended string to
use as a
[source](http://support.metrics.librato.com/knowledgebase/articles/47904-what-is-a-source-)
for all measurements from this statsd instance. This should be unique
for each statsd process. If unset, the source will default to the
node's hostname.

## Enabling

Add the `statsd-librato-backend` backend to the list of StatsD
backends in the StatsD configuration file:

```js
{
  backends: ["statsd-librato-backend"]
}
```

Start/restart the statsd daemon and your StatsD metrics should now be
pushed to your Librato Metrics account.


## Additional configuration options

The Librato backend also supports the following optional configuration
options under the top-level `librato` hash:

* `sourceRegex`: An optional JavaScript regular expression to extract
                 the source name from the measurement name. The first
                 capturing group of the regex is used as the source name,
                 and everything not matched will be the measurement name.

                 Example formats:

                 "SOURCE.MEASURE" => /^([^\.]+)\./
                 "MEASURE.SOURCE" => /\.([^\.]+)$/
                 "server.SOURCE.MEASURE" => /^server\.([^\.]+)\./

* `snapTime`: Measurement timestamps are snapped to this interval
              (specified in seconds). This makes it easier to align
              measurements sent from multiple statsd instances on a
              single graph. Default is to use the flush interval time.

* `countersAsGauges`: A boolean that controls whether StatsD counters
                      are sent to Librato as gauge values (default) or
                      as counters. When set to true (default), the
                      backend will send the aggregate value of all
                      increment/decrement operations during a flush
                      period as a gauge measurement to Librato.

                      When set to false, the backend will track the
                      running value of all counters and submit the
                      current absolute value to Librato as a
                      counter. This will require some additional
                      memory overhead and processing time to track the
                      running value of all counters.

* `skipInternalMetrics`: Boolean of whether to skip publishing of
                         internal statsd metrics. This includes all
                         metrics beginning with 'statsd.' and the
                         metric numStats. Defaults to true, implying
                         they are not sent.

* `retryDelaySecs`: How long to wait before retrying a failed
                    request, in seconds.

* `postTimeoutSecs`: Max time for POST requests to Librato, in
                     seconds.

## Reducing published data for inactive stats

By default StatsD will push a zero value for any counter that does not
receive an update during a flush interval. Similarly, it will continue
to push the last seen value of any gauge that hasn't received an
update during the flush interval. This is required for some backend
systems that can not handle sporadic metric reports and therefore
require a fixed frequency of incoming metrics. However, it requires
StatsD to track all known gauges and counters and means that published
payloads are inflated with zero-fill data.

Librato can handle sporadic metric publishing at non-fixed
frequencies. Any "zero filling" of graphs is handled at display time
on the frontend. Therefore, when using the Librato backend it is
beneficial for bandwidth and measurement-pricing costs to reduce the
amount of data sent to Librato. In the StatsD configuration file it is
recommended that you enable the following top-level configuration
directive to reduce the amount of zero-fill data StatsD sends:

```json
{
   deleteIdleStats: true
}
```

You can configure your metric in Librato to display the gaps between
sporadic reports in a variety of ways. Visit the [knowledge base
article](http://support.metrics.librato.com/knowledgebase/articles/98900-what-if-i-am-reporting-metrics-at-irregular-interv)
to see how to change the display attributes.

## Setting the source per-metric

All metrics sent by the statsd server will use the source name
configured in the global configuration file. You can also set a source
name on a per-stat basis by leveraging the `sourceRegex`
configuration option. The statsd protocol only supports a single name
string per stat, so to specify a source name you have to include it
in the stat name. The `sourceRegex` option sets a regular expression
filter that splits the source and metric names from the single statsd
stat name.

For example, to prefix your stat name with a source name separated by
a period, you would use the `sourceRegex`:
```
{
  sourceRegex: /^([^\.]+)\./
}
```
Sending a stat name of *web-prod-23.api-requests.2xx* would use a metric name
of *api-requests.2xx* and a source name of *web-prod-23*.

Unfortunately, the set of characters that you can use to delimit
source from metric is limited to: `[a-zA-Z_\-0-9\.]`. The statsd
daemon will substitute any characters not in that set before passing
the stat to the Librato backend.

## Publishing to Graphite and Librato Metrics simultaneously

You can push metrics to Graphite and Librato Metrics simultaneously as
you evaluate Librato. Just include both backends in the `backends`
variable:

```js
{
  backends: [ "./backends/graphite", "statsd-librato-backend" ],
  ...
}
```

See the [statsd][statsd] manpage for more information.

## Using Proxy

If you want to use statsd-librato-backend througth a proxy you should
install **tunnel** module:

        $npm install tunnel

After that you should add the *proxy* config to the StatsD config file
in the librato configuration section:

```js
{
  "librato" : {
    "proxy" : {
      "uri" : "http://127.0.0.01:8080"
    }
  }
}
```

That configuration will proxy requests via a proxy listening on
localhost on port 8080. You can also use an https proxy by setting the
protocol to https in the URI.

## NPM Dependencies

None

## Upgrading from versions prior to 0.1.0

If you are upgrading from the statsd-librato-backend before version
0.1.0, the default representation for counter metrics has
changed. Starting with 0.1.0, statsd counters are now represented as
Librato gauges by default. If you were using the default configuration
prior to 0.1.0, then you may run into conflicts when you try to push
statsd counter metrics to Librato as gauges. To fix this, you have two
options:

1) Keep the prior behavior of sending statsd counters as Librato
counters. Just set the `countersAsGauges` configuration variable to
*false* in your statsd config.

2) After upgrading to 0.1.0, remove all counter metrics that were
published by statsd. You can use the API pattern DELETE route to mass
delete metrics. To delete only counter metrics, add the parameter
`metric_type=counter`.

## Development

- [Librato Metrics Backend](https://github.com/librato/statsd-librato-backend)

If you want to contribute:

1. Clone your fork
2. Hack away
3. If you are adding new functionality, document it in the README
4. Push the branch up to GitHub
5. Send a pull request

[statsd]: https://github.com/etsy/statsd
