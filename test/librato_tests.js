'use strict';

const events = require('events');
const serverPort = 36001;
const librato = require('../lib/librato.js');
const nock = require('nock');

var emitter;

module.exports = {
  setUp: function(callback) {
    emitter = new events.EventEmitter();

    this.apiServer = nock('http://127.0.0.1:36001')
                         .defaultReplyHeaders({'Content-Type': 'application/json'});

    this.config = {
      debug: false,
      librato: {
        email: '-@-',
        token: '-',
        api: 'http://127.0.0.1:' + serverPort,
        writeToLegacy: false,
        batchSize: 5,
      },
    };

    librato.init(null, this.config, emitter);
    callback();
  },

  tearDown: function(callback) {
    callback();
  },

  testValidMeasurementNoTags: function(test) {
    test.expect(4);
    let metrics = {gauges: {my_gauge: 1}};
    this.apiServer.post('/v1/measurements')
             .reply(200, function(uri, requestBody) {
                let measurement = requestBody.measurements[0];
                test.ok(requestBody);
                test.equal(measurement.name, 'my_gauge');
                test.equal(measurement.value, 1);
                test.deepEqual(measurement.tags, {});
                test.done();
             });

    emitter.emit('flush', 123, metrics);
  },

  testValidMeasurementSingleTag: function(test) {
    test.expect(4);
    let metrics = {gauges: {'my_gauge#foo=bar': 1}};
    this.apiServer.post('/v1/measurements')
             .reply(200, function(uri, requestBody) {
                let measurement = requestBody.measurements[0];
                test.ok(requestBody);
                test.equal(measurement.name, 'my_gauge');
                test.equal(measurement.value, 1);
                test.deepEqual(measurement.tags, {foo: 'bar'});
                test.done();
             });

    emitter.emit('flush', 123, metrics);
  },

  testValidMeasurementMultipleTags: function(test) {
    test.expect(4);
    let metrics = {gauges: {'my_gauge#foo=bar,biz=baz': 1}};
    this.apiServer.post('/v1/measurements')
             .reply(200, function(uri, requestBody) {
                let measurement = requestBody.measurements[0];
                test.ok(requestBody);
                test.equal(measurement.name, 'my_gauge');
                test.equal(measurement.value, 1);
                test.deepEqual(measurement.tags, {
                  foo: 'bar',
                  biz: 'baz',
                });
                test.done();
             });

    emitter.emit('flush', 123, metrics);
  },

  testTimers: function(test) {
    test.expect(7);
    let metrics = {
      timers: {
        'my_timer#tag=foo': [
          41,
          73.5,
        ],
      },
      timer_data: {'my_timer#tag=foo': null},
    };
    this.apiServer.post('/v1/measurements')
             .reply(200, function(uri, requestBody) {
                let measurement = requestBody.measurements[0];
                test.ok(measurement);
                test.equal(measurement.name, 'my_timer');
                test.equal(measurement.value, undefined);
                test.equal(measurement.min, 41);
                test.equal(measurement.max, 73.5);
                test.equal(measurement.sum, 114.5);
                test.deepEqual(measurement.tags, {tag: 'foo'});
                test.done();
             });

    emitter.emit('flush', 123, metrics);
  },

  testIgnoreBrokenMetrics: function(test) {
    test.expect(0);
    let metrics = {
      gauges: {
        cool_gauge: 123,
        bad_counter: 321,
      },
    };
    let errors = {errors: {params: {type: ['\'bad_counter\'' + ' is a counter, but was' + ' submitted as different type']}}};

    this.apiServer.post('/v1/measurements')
                  .replyWithError(errors)
                  .post('/v1/measurements')
                  .reply(200, function(uri, requestBody) {
                    test.done();
                  });

    emitter.emit('flush', 123, metrics);
  },

  testMaxBatchSize: function(test) {
    test.expect(0);
    var gauges = {};
    for (var i = 0; i < 5; i++) {
      var key = 'gauge' + i;
      gauges[key] = 1;
    }
    var metrics = {gauges: gauges};

    test.done();
  },
};
