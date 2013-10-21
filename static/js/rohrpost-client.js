(function() {
    function Rohrpost(options) {
        var that = this;

        var connectionUrl = options.connectionUrl;

        // Simple exponential backoff for reconnects
        var backoffIntervalInitial = 500;
        var backoffIntervalStop = 60000;
        var backoffInterval = backoffIntervalInitial;

        var closing = false;
        var open = false;
        var openEventHasBeenEmitted = false;

        // Create a random sessionId
        var sessionId = Math.random().toString(36).substr(2);

        var sockjs;

        // This will be used whilst a reconnect or similar is going on.
        // Should be empty most of the time
        var messageQueue = [];

        /*******************
         * Public interface
         *******************/

        /**
         * This method sends a payload to a specific topic. Should this socket
         * not be allowed to send to this topic the message will be silently
         * dropped.
         */
        that.publish = function(topic, data) {
            var payload = {
                'topic': topic,
                'data': data
            };
            if (open) {
                send(payload);
            } else {
                messageQueue.push(payload);
            }
        };

        that.close = function() {
            closing = true;
            sockjs.close();
        }

        that.log = function(level, message) {
            console.log('[' + level + ']', message);
        }

        /*******************
         * Private methods
         *******************/

        /**
         * This function connects to the server. To do so it first does an
         * ajax request to figure out which host/port to connect to and
         * then tries to connect via SockJS. Should something go wrong,
         * try again.
         */
        function connect() {
            ajax(connectionUrl, function(err, sockjsUrl) {
                if (err) {
                    if (err.status == 404 || err.status == 0) {
                        reconnectAfterError();
                    } else {
                        console.error('uncaught error', err);
                    }
                    return;
                }

                if (!sockjsUrl) {
                    throw "Couldn't get connection URL from " + connectionUrl;
                }
                sockjs = new SockJS(sockjsUrl);
                sockjs.onopen = function() {
                    console.log(sessionId);
                    sockjs.send(sessionId);
                    // Reset backoff interval
                    backoffInterval = backoffIntervalInitial;
                }
                sockjs.onmessage = sockjsOnMessage;
                sockjs.onclose = sockjsOnClose;
            });
        }

        /**
         * This method should be called after an unexpected disconnect of
         * in case of an unsuccessful ajax request. Uses exponential backoff
         * to avoid flooding the server with reconnect requests
         */
        function reconnectAfterError(onOpen) {
            if (backoffInterval < backoffIntervalStop) {
                setTimeout(function() {
                    backoffInterval *= 2;
                    connect(onOpen);
                }, backoffInterval);
                console.log('Connection lost. Attempting to reconnect in %dms', backoffInterval);
            } else {
                console.log('Couldn\'t reconnect. Giving up');
            }
        }

        /**
         * This is used as an event handler for first-time connection attempts.
         * Basically we only want to emit 'open' once
         */
        function sockjsOnOpenFirstTime() {
            console.log('Successfully connected.');
            that.emit('open');
            flushMessageQueue();
        }

        /**
         * This will be called after a successful reconnect
         */
        function sockjsOnReconnect() {
            console.log('Successfully reconnected.');
            flushMessageQueue();
        }

        /**
         * This should be called after a connection to the server has been
         * (re-)established to send all messages that have been queued in
         * the meantime.
         */
        function flushMessageQueue() {
            while(messageQueue.length > 0) {
                send(messageQueue.pop());
            }
        }

        /**
         * Close events are a bit more complicated, since some of them
         * are expected (e.g. we know how to handle them) but others are
         * unexptected. We should always attempt to handle close events
         * as gracefully as possible, without disturbing user experience
         * unnecessarily.
         */
        function sockjsOnClose(e) {
            open = false;

            if (closing) {
                that.log('debug', 'Closed connection');
                return;
            }
            if (e.code == 100) {
                // The client is asked to reconnect.
                connect(sockjsOnReconnect);
            } else if (!e.wasClean) {
                // Something bad happened
                reconnectAfterError(sockjsOnReconnect);
            } else {
                // If we end up here we should analyse the error and write a
                // custom handler for it.
                console.error('Unhandled close event', e);
            }
        }

        /**
         * This gets called when we receive a raw message from sockjs.
         * We need to unwrap and emit it.
         */
        function sockjsOnMessage(message) {
            var data = message.data;
            that.log('debug', 'received message: ' + data);
            if (!open) {
                if (data == 'ok:' + sessionId) {
                    open = true;
                    flushMessageQueue();

                    // only emit 'open' once
                    if (!openEventHasBeenEmitted) {
                        openEventHasBeenEmitted = true;
                        that.emit('open');
                    }
                } else {
                    that.log('error', 'Handshake was not successful (' + data + ' != ok:' + sessionId + ')');
                }
            } else {
                var payload = JSON.parse(data);
                that.emit(payload.topic, payload.data);
            }

        }

        /**
         * This is helper function that sends a raw json object over the
         * wire.
         */

         function send(rawObject) {
            sockjs.send(JSON.stringify(rawObject));
         }


        /***************
         * Constructor
         ***************/
        connect();
    }


    /*******************
     * Helper code
     *******************/

     // Ajax helper function, see http://stackoverflow.com/questions/8567114/how-to-make-an-ajax-call-without-jquery
    function ajax(url, callback){
        var xmlhttp;
        // compatible with IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function(){
            if (xmlhttp.readyState == 4) {
                if (xmlhttp.status == 200){
                    callback(null, xmlhttp.responseText);
                } else {
                    callback(xmlhttp);
                }
            }
        }
        xmlhttp.open("GET", url, true);
        xmlhttp.send();
    }

    // Expose the class either via AMD, CommonJS or the global object
    if (typeof define === 'function' && define.amd) {
        define(function () {
            return Rohrpost;
        });
    }
    else if (typeof module === 'object' && module.exports){
        module.exports = Rohrpost;
    }
    else {
        this.Rohrpost = Rohrpost;
    }

    // TODO: Make this a module
    /*!
     * EventEmitter v4.2.3 - git.io/ee
     * Oliver Caldwell
     * MIT license
     * @preserve
     */
    !function(){"use strict";function t(){}function r(t,n){for(var e=t.length;e--;)if(t[e].listener===n)return e;return-1}function n(e){return function(){return this[e].apply(this,arguments)}}var e=t.prototype;e.getListeners=function(n){var r,e,t=this._getEvents();if("object"==typeof n){r={};for(e in t)t.hasOwnProperty(e)&&n.test(e)&&(r[e]=t[e])}else r=t[n]||(t[n]=[]);return r},e.flattenListeners=function(t){var e,n=[];for(e=0;e<t.length;e+=1)n.push(t[e].listener);return n},e.getListenersAsObject=function(n){var e,t=this.getListeners(n);return t instanceof Array&&(e={},e[n]=t),e||t},e.addListener=function(i,e){var t,n=this.getListenersAsObject(i),s="object"==typeof e;for(t in n)n.hasOwnProperty(t)&&-1===r(n[t],e)&&n[t].push(s?e:{listener:e,once:!1});return this},e.on=n("addListener"),e.addOnceListener=function(e,t){return this.addListener(e,{listener:t,once:!0})},e.once=n("addOnceListener"),e.defineEvent=function(e){return this.getListeners(e),this},e.defineEvents=function(t){for(var e=0;e<t.length;e+=1)this.defineEvent(t[e]);return this},e.removeListener=function(i,s){var n,e,t=this.getListenersAsObject(i);for(e in t)t.hasOwnProperty(e)&&(n=r(t[e],s),-1!==n&&t[e].splice(n,1));return this},e.off=n("removeListener"),e.addListeners=function(e,t){return this.manipulateListeners(!1,e,t)},e.removeListeners=function(e,t){return this.manipulateListeners(!0,e,t)},e.manipulateListeners=function(r,t,i){var e,n,s=r?this.removeListener:this.addListener,o=r?this.removeListeners:this.addListeners;if("object"!=typeof t||t instanceof RegExp)for(e=i.length;e--;)s.call(this,t,i[e]);else for(e in t)t.hasOwnProperty(e)&&(n=t[e])&&("function"==typeof n?s.call(this,e,n):o.call(this,e,n));return this},e.removeEvent=function(n){var e,r=typeof n,t=this._getEvents();if("string"===r)delete t[n];else if("object"===r)for(e in t)t.hasOwnProperty(e)&&n.test(e)&&delete t[e];else delete this._events;return this},e.emitEvent=function(r,o){var e,i,t,s,n=this.getListenersAsObject(r);for(t in n)if(n.hasOwnProperty(t))for(i=n[t].length;i--;)e=n[t][i],e.once===!0&&this.removeListener(r,e.listener),s=e.listener.apply(this,o||[]),s===this._getOnceReturnValue()&&this.removeListener(r,e.listener);return this},e.trigger=n("emitEvent"),e.emit=function(e){var t=Array.prototype.slice.call(arguments,1);return this.emitEvent(e,t)},e.setOnceReturnValue=function(e){return this._onceReturnValue=e,this},e._getOnceReturnValue=function(){return this.hasOwnProperty("_onceReturnValue")?this._onceReturnValue:!0},e._getEvents=function(){return this._events||(this._events={})},"function"==typeof define&&define.amd?define(function(){return t}):"object"==typeof module&&module.exports?module.exports=t:this.EventEmitter=t}.call(this);

    Rohrpost.prototype = new EventEmitter();
    Rohrpost.prototype.constructor = Rohrpost;
})(this);

