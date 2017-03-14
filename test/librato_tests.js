var librato_init = require('../lib/librato.js').init,
    http = require('http'),
    events = require('events'),
    server_port = 36001;

module.exports = {
  setUp: function(callback) {
    this.server = http.createServer();
    this.server.listen(server_port, '127.0.0.1', function() {
      callback();
    });

    this.emitter = new events.EventEmitter();
    this.api_mock = function(validRequest, errorResponse, callback) {
      return function(req, res) {
        var data = '';
        req.on('data', function(chunk) {
          data += chunk;
        });
        req.on('end', function() {
          if (validRequest) {
            var body = JSON.parse(data);
            res.writeHead(200, {});
            res.end('');
            callback(req, res, body);
          } else {
            res.writeHead(400, {'content-type': 'application/json'});
            res.end(JSON.stringify(errorResponse));
            callback(req, res, body);
          }
        });

      };
    };

    // Librato Backend
    librato_init(null, {
      debug: false,
      librato: {
        email: '-@-',
        token: '-',
        api: 'http://127.0.0.1:' + server_port,
        writeToLegacy: false
      }
    }, this.emitter);
  },

  tearDown: function (callback) {
    this.server.close(function() {
      callback();
    });
  },

  testValidMeasurementNoTags: function(test) {
    test.expect(4);
    var metrics = {
      gauges: {
        my_gauge: 1
      }
    };

    this.server.once('request', this.api_mock(true, {}, function(req, res, body) {
      var measurement = body.measurements[0];
      test.ok(measurement);
      test.equal(measurement.name, "my_gauge");
      test.equal(measurement.value, 1);
      test.deepEqual(measurement.tags, {});
      test.done();
      
    }));

    this.emitter.emit('flush', 123, metrics);
  },

  testValidMeasurementTags: function(test) {
    test.expect(4);
    var metrics = {
      gauges: {
        "my_gauge#foo=bar": 1
      }
    };

    this.server.once('request', this.api_mock(true, {}, function(req, res, body) {
      var measurement = body.measurements[0];
      test.ok(measurement);
      test.equal(measurement.name, "my_gauge");
      test.equal(measurement.value, 1);
      test.deepEqual(measurement.tags, {foo: "bar"});
      test.done();
    }));

    this.emitter.emit('flush', 123, metrics);
  },

  testIgnoreBrokenMetrics: function(test) {
    test.expect(1);
    var metrics = {
      gauges: {
        cool_gauge: 123,
        bad_counter: 321
      }
    };


    var errors = {
      errors: {
        params: {
          type: [
            "'bad_counter'" +
              " is a counter, but was" +
              " submitted as different type"
          ]
        }
      }
    };

    // Simulate failure...
    this.server.once('request', this.api_mock(false, errors, function(req, res, body) {
      test.equal(res.statusCode, 400);
      test.done();
    }.bind(this)));
    this.emitter.emit('flush', 123, metrics);
  }
};
