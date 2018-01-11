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
import {averageColorNormalized} from 'average-color';
import express from 'express';
import huejay from 'huejay';
import opn from 'opn';
import SpotifyWebApi from 'spotify-web-api-node';
import {clearCorrectingInterval, setCorrectingInterval} from 'correcting-interval';

import credentials from './.credentials.json';

const QUARTER_NOTES = 2;

// Color variables.
const SATURATION = 1;
const BRIGHTNESS = 1;

const app = express();

const hueClient = new huejay.Client(credentials.hue);
const spotifyClient = new SpotifyWebApi(credentials.spotify);


app.listen(1312, () => {
	opn(spotifyClient.createAuthorizeURL(['user-read-currently-playing'], null));
});

app.get('/callback', (req, res) => {
	res.send(`
		<head>
			<style>
				body {
					background: #000;
					margin: 0;
				}
				.container {
					color: #fff;
					left: 50%;
					position: absolute;
					top: 50%;
					text-align: center;
					transform: translate(-50%, -50%);
				}
				h1 {
					font-size: 200px;
					margin: 0;
					white-space: nowrap;
				}
				p {
					font-size: 48px;
				}
			</style>
		</head>
		<body>
			<div class="container">
				<h1>🤘 Playing 🤘</h1>
				<p>You can close this window now.</p>
			</div>
		</body>
	`);

	spotifyClient.authorizationCodeGrant(req.query.code).then(data => {
		spotifyClient.setAccessToken(data.body['access_token'])
		spotifyClient.setRefreshToken(data.body['refresh_token'])

		let currentTrack;
		let intervalId;
		let toggle = true;
		let hue = 230;

		const checkForNewSong = () => {
			spotifyClient.getMyCurrentPlayingTrack()
				.then(({body: {item}}) => {
					const newTrack = item.id;
					if (newTrack === currentTrack) return;
					clearCorrectingInterval(intervalId);
					currentTrack = newTrack;

					spotifyClient.getAudioFeaturesForTrack(currentTrack)
						.then(({body: audioFeatures}) => {
							const period = 60 / audioFeatures.tempo * QUARTER_NOTES;

							hueClient.lights.getAll()
								.then(lights => {
									const updateLights = () => lights.forEach(light => {
										if (!light.reachable) return;

										light.on = toggle;
										light.transitionTime = Math.floor(period * 10) / 10;

										if (toggle) {
											light.hue = Math.round(hue / 360 * 65535);        // uint16
											light.brightness = Math.round(BRIGHTNESS * 254);  // uint8
											light.saturation = Math.round(SATURATION * 254);  // uint8
										}

										hueClient.lights.save(light);
									});

									updateLights();
									intervalId = setCorrectingInterval(() => {
										toggle = !toggle;
										hue = (hue + 4) % 360;
										updateLights();
									}, period * 1000);
								})
								.catch(err => console.log(`We couldn't connect to the lights: ${err}`));
						})
						.catch(err => console.log(`We couldn't analyze the track: ${err}`));
				})
				.catch(err => {
					console.log('We couldn\'t connect to the Spotify API.');
					console.log('\n');
					console.log(`Error ${err.statusCode}: ${err}`);
					console.log(err.message);
				});
		};

		checkForNewSong();
		setCorrectingInterval(checkForNewSong, 1000);  // Re-check for new song every second.
	}).catch(err => console.log('Uh oh, auth failed:', err));
});
