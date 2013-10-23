Rohrpost
========
<b>This is work in progress and nowhere near production ready.</b>

A front-facing layer that maintains (secure) websocket connections with browsers and passing messages through to pub/sub systems or http endpoints. Think of it as an apache for websockets (and then forget about it, because that comparision falls short on quite a few points).

It's designed to be a thin and generic layer that adresses the following problems:

* Load balancing without the need for any websocket-enabled reverse proxies
* Multi-process architecture with a supervisor process
* Support for sharding over multiple machines
* WSS encryption
* Cross-browser support through the use of sock.js as an abstraction layer
* Staged restarts for interuption-free updates

Underlaying components don't have to support long-lasting connections and all the problems they entail.

Load balancing is achieved by opening one external port for each worker process and telling the client which one to choose before opening a connection. This way no reverse proxy layer is needed to tunnel all websockets.

Messages from and to the client are filtered by a whitelist of allowed topics to allow fine-grained access control. Imagine a chat server where new users  are initially only whitelisted for direct messages, but will later (e.g. on joining channels) be allowed more access to other topics.

Install
=======

* Clone this repository
* ```$ sudo npm install -g```
* Go to /etc/rohrpost, update and rename the config file to config.js
* Change your https certificates in /etc/rohrpost/keys or update the path to the correct location




