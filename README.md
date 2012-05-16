# StatsD Librato Metrics backend

## Overview

This is a pluggable backend for [StatsD](https://github.com/etsy/statsd), which
publishes stats to [Librato Metrics](https://metrics.librato.com).

## Requirements

* [StatsD](https://github.com/etsy/statsd) versions >= 0.3.0.
* An active [Librato Metrics](https://metrics.librato.com/sign_up) account.

## Installation

    npm install statsd-librato-backend

## Configuration

You have to add the following basic configuration information to your
StatsD config file.

```js
{
  librato: {
    email: "myemail@example.com",
    token: "ca98e2bc23b1bfd0cbe9041e824f610491129bb952d52ca4ac22cf3eab5a1c32",
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

* `source`: An optional source name to use for all measurements.

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

## Dependencies

None

## Development

- [Librato Metrics Backend](https://github.com/librato/statsd-librato-backend)

If you want to contribute:

1. Clone your fork
2. Hack away
3. If you are adding new functionality, document it in the README
4. Push the branch up to GitHub
5. Send a pull request
