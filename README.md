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

* `source`: An optional-but-recommended source name to use for all
            measurements. This should be unique for each statsd
            process.

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
                      are sent as native Librato Metrics counters
                      (default) or as Librato Metrics gauges. The
                      original Librato statsd fork sent StatsD
                      counters as gauges instead of counters, so this
                      provides an easy upgrade path. Defaults to
                      false.

* `skipInternalMetrics`: Boolean of whether to skip publishing of
                         internal statsd metrics. This includes all
                         metrics beginning with 'statsd.' and the
                         metric numStats. Defaults to true, implying
                         they are not sent.

* `retryDelaySecs`: How long to wait before retrying a failed
                    request, in seconds.

* `postTimeoutSecs`: Max time for POST requests to Librato, in
                     seconds.

## Upgrading from the old Librato statsd fork

If you are upgrading from the old Librato [statsd
fork](https://github.com/librato/statsd), then the minimal upgrade
steps are:

1. Upgrade to the latest [Etsy statsd][statsd].
2. In the statsd directory, install the Librato backend: `npm install
statsd-librato-backend`.
3. Swap the statsd configuration variable `graphService` with
the `backends` list. So if your old configuration looked like:

```js
{
  graphService: "librato-metrics",
  libratoUser: "myemail@example.com",
  libratoApiKey: "ca98e2bc23b1bfd0cbe9041e824f610491129bb952d52ca4ac22cf3eab5a1c32",
  ...
}
```

Then your new configuration would look like:


```js
{
  backends: ["statsd-librato-backend"],
  libratoUser: "myemail@example.com",
  libratoApiKey: "ca98e2bc23b1bfd0cbe9041e824f610491129bb952d52ca4ac22cf3eab5a1c32",
  ...
}
```

The Librato backend will automatically detect a legacy configuration
file and set `countersAsGauges` to *true* to maintain backwards
compatibility.

### Upgrading to native counters

If you would like to upgrade to native Librato Metrics counters, then
you'll need to:

1. Stop all statsd daemons.
2. Switch to the new configuration format listed at the top of this
file, ensuring that `countersAsGauges` is *false* or not set.
3. Using the UX or [API](http://dev.librato.com), delete all
statsd counters that were originally published as gauges to Librato Metrics.
4. Restart all statsd daemons.

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
