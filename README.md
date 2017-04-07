# StatsD Librato backend

[![npm](https://img.shields.io/npm/v/statsd-librato-backend.svg)](https://www.npmjs.com/package/statsd-librato-backend)
[![Travis](https://img.shields.io/travis/librato/statsd-librato-backend.svg)](https://travis-ci.org/librato/statsd-librato-backend)
[![npm](https://img.shields.io/npm/dm/statsd-librato-backend.svg)](https://www.npmjs.com/package/statsd-librato-backend)
[![npm](https://img.shields.io/npm/l/statsd-librato-backend.svg)](https://github.com/librato/statsd-librato-backend/blob/master/LICENSE)
---

**NOTE:** Starting with version 2.0.0 statsd-librato-backend requires a Librato account that [supports tagged metrics](https://www.librato.com/docs/kb/faq/account_questions/tags_or_sources/). 

If your Librato account doesn't yet support tagged metrics or you are using [a heroku addon](https://devcenter.heroku.com/articles/librato), please use the [0.1.x version](https://github.com/librato/statsd-librato-backend/tree/branch-0.1.x).

---

## Overview

This is a pluggable backend for [StatsD][statsd], which
publishes stats to [Librato](https://metrics.librato.com). 

## Requirements

* [StatsD][statsd] versions >= 0.6.0.
* An active [Librato](https://metrics.librato.com/sign_up) account

## Installation

    $ cd /path/to/statsd
    $ npm install statsd-librato-backend

## Configuration

You will need to add the following to your StatsD config file.

```js
librato: {
  email:  "myemail@example.com",
  token:  "ca98e2bc23b1bfd0cbe9041e824f610491129bb952d52ca4ac22cf3eab5a1c32"
}
```

Example Full Configuration File:

```js
{
  librato: {
    email:  "myemail@example.com",
    token:  "ca98e2bc23b1bfd0cbe9041e824f610491129bb952d52ca4ac22cf3eab5a1c32"
  }
  , backends: ["statsd-librato-backend"]
  , port: 8125
  , keyNameSanitize: false
}
```


The *email* and *token* settings can be found on your Librato account
settings page.

## Enabling

Add the `statsd-librato-backend` backend to the list of StatsD
backends in the StatsD configuration file:

```js
{
  backends: ["statsd-librato-backend"]
}
```

Start/restart the statsd daemon and your StatsD metrics should now be
pushed to your Librato account.


## Additional configuration options

The Librato backend also supports the following optional configuration
options under the top-level `librato` hash:

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

* `includeMetrics`: An array of JavaScript regular expressions. Only metrics
                    that match any of the regular expressions will be sent to Librato.
                    Defaults to an empty array.

```js
{
   includeMetrics: [/^my\.included\.metrics/, /^my.specifically.included.metric$/]
}
```

* `excludeMetrics`: An array of JavaScript regular expressions. Metrics which match
                    any of the regular expressions will NOT be sent to Librato. If includedMetrics
                    is specified, then patterns will be matched against the resulting
                    list of included metrics.
                    Defaults to an empty array.

              Metrics which are sent to StatsDThis will exclude metrics sent to StatsD so that metrics which
              match the specified regex value

```js
{
   excludeMetrics: [/^my\.excluded\.metrics/, /^my.specifically.excluded.metric$/]
}
```

* `globalPrefix`: A string to prepend to all measurement names sent to Librato. If set, a dot
                  will automatically be added as separator between prefix and measurement name.

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

## Publishing to Graphite and Librato simultaneously

You can push metrics to Graphite and Librato simultaneously as
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
install **https-proxy-agent** module:

        $npm install https-proxy-agent

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

## Tags

Starting in version 2.x.x and higher, this functionality is enabled by default. If you are interested in using this feature but your Librato account is not enabled for tags, please send us an email at [support@librato.com](support@librato.com) and request access. Otherwise, see this [branch](https://github.com/librato/statsd-librato-backend/tree/branch-0.1.x) for the legacy version 0.1.7.

Our backend plugin offers basic tagging support for your metrics you submit to Librato. You can specify what tags you want to submit to Librato using the *tags*
config in the librato configuration section of the StatsD config file:


```js
{
  "librato" : {
    "tags": { "os" : "ubuntu", "host" : "production-web-server-1", ... }
  }
}
```

Once your config has been updated, all metrics submitted to Librato will include your defined tags.


We also support tags at the per-stat level should you need more detailed tagging. We provide a naming syntax for your stats so you can submit tags for each stat. That syntax is as follows:

```
metric.name#tag1=value,tag2=value:value
```

Starting with a `#`, you would pass in a comma-separated list of tags and we will parse out the tags and values. Given the above example, a stat matching
the above syntax will be submitted as metric to Librato with a name of `metric.name`, a value of `value` and with the tags `tag1=value` and `tag2=value. You are welcome to use any statsd client of your choosing.

Please note that in order to use tags, the statsd config option `keyNameSanitize` must be set to `false` to properly parse tags out of your stat name.

## Docker

You may use `bin/statsd-librato` to easily bootstrap the daemon inside
a container.

Invoking this via `CMD` or `ENTRYPOINT` will create a simple
configuration and run the statsd daemon with this backend enabled,
listening on `8125`.

The following environment variables are available to customize:

 - `LIBRATO_EMAIL`
 - `LIBRATO_TOKEN`
 - `LIBRATO_SOURCE`

## Development

- [Librato Backend](https://github.com/librato/statsd-librato-backend)

If you want to contribute:

1. Clone your fork
2. `yarn install`
3. Hack away
4. If you are adding new functionality, document it in the README
5. Push the branch up to GitHub
6. Send a pull request

[statsd]: https://github.com/etsy/statsd
