/*{id:msgpack.rpc.js,ver:0.10,license:"MIT",author:"nori.0428@gmail.com"}*/

this.msgpack.rpc || (function(globalScope) {

globalScope.msgpack.rpc = {
    /**
     * MessagePack RPC Client<br>
     * <a href="http://wiki.msgpack.org/display/MSGPACK/RPC+specification">
     * http://wiki.msgpack.org/display/MSGPACK/RPC+specification
     * </a>
     * @class
     * @param {string} uri uri of websocket
     * @param {Hash} [callbacks]
     * fire when receive event or notify
     * @param {String} [callbacks.event]
     * fire when receive websocket event
     * @param {String} [callbacks.notify]
     * fire when receive MessagePack notification
     * @return {Object}
     * MessagePack RPC Client Instance or undefined if error occurs
     * @see #event:event_callback
     * @see #event:notify_callback
     * @example
     * (function() {
     *   function notify_callback(e) {
     *     console.log(JSON.stringify(e));
     *   }
     *
     *   function event_callback(e) {
     *     console.log(JSON.stringify(e));
     *   }
     *
     *   function responce_callback_1(r) {
     *     console.log(JSON.stringify(r));
     *   }
     *
     *   function responce_callback_2(r) {
     *     console.log(JSON.stringify(r));
     *   }
     *
     *   var client = new msgpack.rpc.client('ws://host:port/msgpack-rpc',
     *                                       {'notify': notify_callback,
     *                                        'event': event_callback});
     *
     *   // non-block call
     *   client.call_async({'method': 'foo',
     *                      'params': [-1, "string", {'key': 'val'}],
     *                      'callback': response_callback_1,
     *                      'timeout': 10000});
     *   client.call_async({'method': 'bar',
     *                      'params': [-1, "string", {'key': 'val'}],
     *                      'callback': response_callback_2,
     *                      'timeout': 10000});
     *
     *   // non-block notify
     *   client.notify({method: 'foo', params: ['bar', 'baz']});
     *
     *   // suspend client work
     *   client.suspend();
     *
     *   // resume client work if needed
     *   client.resume();
     *
     *   // delete client completely
     *   client.delete();
     *   delete client;
     * })();
     */
    client: msgpackclient
};
    function msgpackclient(uri, callbacks) {
        var sock, stat = 'disconnected', msgid = -1;
        var requests = {}, that = {}, unpacker = new msgpack.unpacker();

        function timeout_request(id) {
            if (requests[id] && typeof requests[id].callback === 'function') {
                requests[id].callback({error: "timeout", result: null});
                delete requests[id];
            }
        }
        function send(data) {
            if (sock.bufferedAmount == 0) {
                sock.send(data.buffer);
            } else {
                setTimeout(function() {
                               send(data);
                           }, 1);
            }
        }
        function send_request(id, args) {
            var frame, pack, data, timeout = 0;

            requests[id] = {};
            if (args.callback && typeof args.callback === 'function') {
                requests[id].callback = args.callback;
                timeout = args.timeout || 30000;
            }
            frame = [0, id, args.method];
            frame.push(args.params);
            pack = msgpack.pack(frame);
            data = new Uint8Array(pack);
            if (timeout > 0) {
                requests[id].tid = setTimeout(function() {
                                                  timeout_request(id);
                                              }, timeout);
            }
            send(data);
        }
        function send_notify(args) {
            var frame, pack, data;

            frame = [2, args.method];
            frame.push(args.params);
            pack = msgpack.pack(frame);
            data = new Uint8Array(pack);
            send(data);
        }
        function recv_message(e) {
            var chunk = [], obj, id;
            var data = new Uint8Array(e.data);

            for (var i = 0; i < data.length; i++) {
                chunk[i] = data[i];
            }
            unpacker.feed(chunk);
            while ((obj = unpacker.unpack()) !== undefined) {
                switch (obj[0]) {
                case 1: // response
                    id = obj[1];
                    if (typeof id !== 'number') {
                        break;
                    }
                    if (requests[id] && typeof requests[id].callback === 'function') {
                        clearTimeout(requests[id].tid);
                        requests[id].callback({error: obj[2], result: obj[3]});
                        delete requests[id];
                    }
                    break;
                case 2: // notify
                    if (that.callbacks && typeof that.callbacks.notify === 'function') {
                        that.callbacks.notify({method: obj[1], params: obj[2]});
                    }
                    break;
                default:
                    break;
                }
            }
        }
        function recv_event(e) {
            if (that.callbacks && typeof that.callbacks.event === 'function') {
                that.callbacks.event(e);
            }
        }
        function try_connect() {
            stat = 'connecting';
            try {
                sock = new WebSocket(that.uri);
            } catch (x) {
                return false;
            }
            sock.binaryType = 'arraybuffer';
            sock.onopen = function(e) {
                stat = 'connected';
                recv_event(e);
            };
            sock.onclose = sock.onerror = function(e) {
                stat = 'disconnected';
                delete sock;
                recv_event(e);
            };
            sock.onmessage = recv_message;
            return true;
        }

        /**
         * do RPC async
         * @methodOf globalScope.msgpack.rpc.client.prototype
         * @param {Hash} args
         * @param {String} args.method method name of request
         * @param {Array} args.params params of request
         * @param {Function} [args.callback]
         * called this function when received response<br>
         * @param {Number} [args.timeout]
         * timeout time[ms], default 30000 ms
         * @see #event:response_callback
         */
        that.call_async = function(args) {
            msgid = (msgid == 0x0ffffffff) ? 0 : msgid + 1;
            if (stat === 'connecting' || typeof requests[msgid] !== 'undefined') {
                setTimeout(function() {
                               that.call_async(args);
                           }, 10);
                return;
            }
            if (stat === 'connected') {
                send_request(msgid, args);
            }
        };
        /**
         * send notify async
         * @methodOf globalScope.msgpack.rpc.client.prototype
         * @param {Hash} args
         * @param {String} args.method method name of notify
         * @param {Array} args.params params of notify
         */
        that.notify = function(args) {
            switch (stat) {
            case 'connecting':
                setTimeout(function() {
                               that.notify(args);
                           }, 10);
                break;
            case 'connected':
                send_notify(args);
                break;
            default:
                break;
            }
        };
        /**
         * resume client work
         * @methodOf globalScope.msgpack.rpc.client.prototype
         * @return {Boolean} success to resume or not
         */
        that.resume = function() {
            if (stat === 'connecting' || stat === 'connected') {
                return true;
            }
            if (stat === 'disconnecting') {
                setTimeout(that.resume, 1);
                return true;
            }
            return try_connect();
        };
        /**
         * suspend client work
         * @methodOf globalScope.msgpack.rpc.client.prototype
         */
        that.suspend = function() {
            stat = 'disconnecting';
            for (var id in requests) {
                clearTimeout(requests[id].tid);
                delete requests[id];
            }
            sock.close();
            msgid = -1;
        };
        /**
         * delete client
         * @methodOf globalScope.msgpack.rpc.client.prototype
         */
        that.delete = that.suspend;

        // initialize
        that.uri = uri;
        that.callbacks = callbacks;
        if (!try_connect()) {
            return undefined;
        }
        return that;

        /**
         * fire when receive websocket event message
         * @name globalScope.msgpack.rpc.client#event_callback
         * @event
         * @param {Hash} e
         * @param {String} e.type type of event
         * [open, close, error]
         */
        /**
         * fire when receive notify message from a server
         * @name globalScope.msgpack.rpc.client#notify_callback
         * @event
         * @param {Hash} e
         * @param {String} e.method method name
         * @param {Array} e.params arguments array
         */
        /**
         * fire when receive response
         * @name globalScope.msgpack.rpc.client#response_callback
         * @event
         * @param {Hash} r
         * @param {String} r.error
         * error message from a server
         * @param {Object that you define} r.result
         * response object from a server
         */
    }
})(this);
