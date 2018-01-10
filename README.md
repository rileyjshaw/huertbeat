huertbeat
=====

**_Hue heartbeat._**

Pulse available Philips hue lights to whatever music is playing.

## Install

```bash
git clone https://github.com/rileyjshaw/huertbeat.git
cd huertbeat
npm i
touch .credentials.json
```

Create a blank Spotify app at https://beta.developer.spotify.com/dashboard/login,
and set the Redirect URL to `http://localhost:1312/callback`. Then, add keys to
`.credentials.json` in the following shape:

```
{
     "hue": {
         "host": <Your Hue bridge's local IP>,
         "username": <Your authenticated Hue bridge ID>
     },
     "spotify": {
         "clientId": <Your Spotify app's client ID>,
         "clientSecret": <Your Spotify app's client secret>,
         "redirectUri": "http://localhost:1312/callback"
     }
}
```

## Use

Play a song on Spotify, turn on your Hue lights, then:

```bash
make start -s
```

---

Licensed under [MIT](https://github.com/rileyjshaw/sweep/blob/master/LICENSE).
Created by [rileyjshaw](http://rileyjshaw.com/).
