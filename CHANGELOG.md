## [2.0.7] - 2017-04-06

### Changed

- Updated some documentation and re-enabled a TravisCI with a build matrix

## [2.0.6] - 2017-04-06

### Fixed
- [#73](https://github.com/librato/statsd-librato-backend/pull/73) Fixed an issue where `sum` was not properly calculated for a timer.

## [2.0.5] - 2017-03-13

### Fixed
- [#70](https://github.com/librato/statsd-librato-backend/pull/70) Fixed an issue where legacy payloads were being sent to Librato incorrectly.

## [2.0.4] - 2017-03-06

### Fixed
- [#67](https://github.com/librato/statsd-librato-backend/pull/67) Fixed an issue where 4xx errors could potentially crash statsd 

## [2.0.3] - 2017-03-02

### Added
- [#65](https://github.com/librato/statsd-librato-backend/pull/65) Ability to disable `hostname` tag

### Changed
- [#66](https://github.com/librato/statsd-librato-backend/pull/66) Better comments / clarification for configuration

## [2.0.2] - 2017-02-10

### Added
- [#61](https://github.com/librato/statsd-librato-backend/pull/61) Bootstrap script

## [2.0.1] - 2017-02-06

### Changed
- Minor feedback and improvements for tagging supprort

## [2.0.0] - 2017-01-24

### Added
- Support for tagged measurements using Librato's new API.

### Deprecated
- Librato's legacy, source-based API. 
