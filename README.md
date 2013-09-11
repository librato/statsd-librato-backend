# StatsD Librato Metrics backend

## Overview

This is a pluggable backend for [StatsD][statsd], which
publishes stats to [Librato Metrics](https://metrics.librato.com).

## Requirements

* [StatsD][statsd] versions >= 0.3.0.
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
for each statsd process.

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

                 Examples formats:

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

## Reducing published data for inactive counters/gauges

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
recommended that you enable the two following top-level configuration
directives:

```json
{
   deleteCounters: true,
   deleteGauges: true
}
```

You can configure your metric in Librato to display the gaps between
sporadic reports in a variety of ways. Visit the [knowledge base
article](http://support.metrics.librato.com/knowledgebase/articles/98900-what-if-i-am-reporting-metrics-at-irregular-interv)
to see how to change the display attributes.

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

## Development

- [Librato Metrics Backend](https://github.com/librato/statsd-librato-backend)

If you want to contribute:

1. Clone your fork
2. Hack away
3. If you are adding new functionality, document it in the README
4. Push the branch up to GitHub
5. Send a pull request

[statsd]: https://github.com/etsy/statsd
