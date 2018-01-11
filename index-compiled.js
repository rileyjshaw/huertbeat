'use strict';

/**
 * Huertbeat (noun): Hue heartbeat.
 *
 * Uses huejay and the Spotify Web API to pulse available Philips hue lights to
 * whatever music is playing.
 *
 * Use:
 *
 *   # Create an empty Spotify app, set the Redirect URL to
 *   # "http://localhost:1312/callback", get an authentication ID for your Hue
 *   # bridge, then:
 *
 *   > touch .credentials.json
 *
 *   # Add keys in the following shape:
 *   # {
 *   #      "hue": {
 *   #          "host": <Your Hue bridge's local IP>,
 *   #          "username": <Your authenticated Hue bridge ID>
 *   #      },
 *   #      "spotify": {
 *   #          "clientId": <Your Spotify app's client ID>,
 *   #          "clientSecret": <Your Spotify app's client secret>,
 *   #          "redirectUri": "http://localhost:1312/callback"
 *   #      }
 *   # }

 *   > npm i
 *   > make start -s
 *
 */

var _averageColor = require('average-color');

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _huejay = require('huejay');

var _huejay2 = _interopRequireDefault(_huejay);

var _opn = require('opn');

var _opn2 = _interopRequireDefault(_opn);

var _spotifyWebApiNode = require('spotify-web-api-node');

var _spotifyWebApiNode2 = _interopRequireDefault(_spotifyWebApiNode);

var _correctingInterval = require('correcting-interval');

var _credentials = require('./.credentials.json');

var _credentials2 = _interopRequireDefault(_credentials);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var QUARTER_NOTES = 2;

// Color variables.
var SATURATION = 1; // [0, 1].
var BRIGHTNESS = 1; // [0, 1].
var INITIAL_HUE = 230; // Degrees.
var HUE_INCREMENT = 53; // Degrees.
var SMOOTHNESS = 0.8; // [0, 1] with 1 being the smoothest transition.

var app = (0, _express2.default)();

var hueClient = new _huejay2.default.Client(_credentials2.default.hue);
var spotifyClient = new _spotifyWebApiNode2.default(_credentials2.default.spotify);

app.listen(1312, function () {
	(0, _opn2.default)(spotifyClient.createAuthorizeURL(['user-read-currently-playing'], null));
});

app.get('/callback', function (req, res) {
	res.send('\n\t\t<head>\n\t\t\t<style>\n\t\t\t\tbody {\n\t\t\t\t\tbackground: #000;\n\t\t\t\t\tmargin: 0;\n\t\t\t\t}\n\t\t\t\t.container {\n\t\t\t\t\tcolor: #fff;\n\t\t\t\t\tleft: 50%;\n\t\t\t\t\tposition: absolute;\n\t\t\t\t\ttop: 50%;\n\t\t\t\t\ttext-align: center;\n\t\t\t\t\ttransform: translate(-50%, -50%);\n\t\t\t\t}\n\t\t\t\th1 {\n\t\t\t\t\tfont-size: 200px;\n\t\t\t\t\tmargin: 0;\n\t\t\t\t\twhite-space: nowrap;\n\t\t\t\t}\n\t\t\t\tp {\n\t\t\t\t\tfont-size: 48px;\n\t\t\t\t}\n\t\t\t</style>\n\t\t</head>\n\t\t<body>\n\t\t\t<div class="container">\n\t\t\t\t<h1>\uD83E\uDD18 Playing \uD83E\uDD18</h1>\n\t\t\t\t<p>You can close this window now.</p>\n\t\t\t</div>\n\t\t</body>\n\t');

	spotifyClient.authorizationCodeGrant(req.query.code).then(function (data) {
		spotifyClient.setAccessToken(data.body['access_token']);
		spotifyClient.setRefreshToken(data.body['refresh_token']);

		var currentTrack = void 0;
		var intervalId = void 0;
		var toggle = true;
		var hue = INITIAL_HUE;

		var checkForNewSong = function checkForNewSong() {
			spotifyClient.getMyCurrentPlayingTrack().then(function (_ref) {
				var item = _ref.body.item;

				var newTrack = item.id;
				if (newTrack === currentTrack) return;
				(0, _correctingInterval.clearCorrectingInterval)(intervalId);
				currentTrack = newTrack;

				spotifyClient.getAudioFeaturesForTrack(currentTrack).then(function (_ref2) {
					var audioFeatures = _ref2.body;

					var period = 60 / audioFeatures.tempo * QUARTER_NOTES;

					hueClient.lights.getAll().then(function (lights) {
						var updateLights = function updateLights() {
							return lights.forEach(function (light) {
								if (!light.reachable) return;

								light.on = toggle;
								light.transitionTime = Math.floor(period * 10 * SMOOTHNESS) / 10;

								if (toggle) {
									light.hue = Math.round(hue / 360 * 65535); // uint16
									light.brightness = Math.round(BRIGHTNESS * 254); // uint8
									light.saturation = Math.round(SATURATION * 254); // uint8
								}

								hueClient.lights.save(light);
							});
						};

						updateLights();
						intervalId = (0, _correctingInterval.setCorrectingInterval)(function () {
							toggle = !toggle;
							hue = (hue + HUE_INCREMENT) % 360;
							updateLights();
						}, period * 1000);
					}).catch(function (err) {
						return console.log('We couldn\'t connect to the lights: ' + err);
					});
				}).catch(function (err) {
					return console.log('We couldn\'t analyze the track: ' + err);
				});
			}).catch(function (err) {
				console.log('We couldn\'t connect to the Spotify API.');
				console.log('\n');
				console.log('Error ' + err.statusCode + ': ' + err);
				console.log(err.message);
			});
		};

		checkForNewSong();
		(0, _correctingInterval.setCorrectingInterval)(checkForNewSong, 1000); // Re-check for new song every second.
	}).catch(function (err) {
		return console.log('Uh oh, auth failed:', err);
	});
});
