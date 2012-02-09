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
     * @param {Function} [event_callback]
     * called when received event<br>
     * @return {Object}
     * MessagePack RPC Client Instance or undefined if error occurs
     * @see #event:event_callback
     * @example
     * (function() {
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
     *                                       event_callback);
     *   // non-block
     *   client.call_async({'method': 'foo',
     *                      'params': [-1, "string", {'key': 'val'}],
     *                      'callback': response_callback_1,
     *                      'timeout': 10000});
     *   client.call_async({'method': 'bar',
     *                      'params': [-1, "string", {'key': 'val'}],
     *                      'callback': response_callback_2,
     *                      'timeout': 10000});
     * })();
     */
    client: msgpackclient
};
    function msgpackclient(uri, event_callback) {
        var sock, connected = false, msgid = -1;
        var requests = {}, that = {}, unpacker = new msgpack.unpacker();

        function send_request(id, rpc) {
            var frame, pack, ui8v, timeout = 30000;

            function send() {
                if (sock.bufferedAmount == 0) {
                    timeout = rpc.timeout || 30000;
                    requests[id].tid = setTimeout(function() {
                                                          timeout_request(id);
                                                      }, timeout);
                    sock.send(ui8v.buffer);
                } else {
                    setTimeout(send, 50);
                }
            }

            requests[id] = {};
            if (rpc.callback && typeof rpc.callback === 'function') {
                requests[id].callback = rpc.callback;
            }
            frame = [0, id, rpc.method];
            frame.push(rpc.params);
            pack = msgpack.pack(frame);
            ui8v = new Uint8Array(pack);
            send();
        }
        function timeout_request(id) {
            if (typeof requests[id] !== 'undefined') {
                requests[id].callback({'error': 'timeout', 'result': null});
                delete requests[id];
            }
        }
        function recv_response(e) {
            var pack = [], r, event = {};
            var ui8v = new Uint8Array(e.data);

            for (var i = 0; i < ui8v.length; i++) {
                pack[i] = ui8v[i];
            }
            unpacker.feed(pack);
            while ((r = unpacker.unpack()) !== undefined) {
                if (r[0] == 1 && typeof requests[r[1]] !== 'undefined') {
                    clearTimeout(requests[r[1]].tid);
                    requests[r[1]].callback({'error': r[2], 'result': r[3]});
                    delete requests[r[1]];
                }
                if (r[0] == 2) {
                    event.type = 'message';
                    event.method = r[1];
                    event.params = r[2];
                    recv_event(event);
                }
            }
        }
        function recv_event(e) {
            if (typeof that.event_callback === 'function') {
                that.event_callback(e);
            }
        }

        /**
         * do RPC async
         * @memberOf globalScope.msgpack.rpc.client.prototype
         * @param {Hash} rpc
         * @param {String} rpc.method method name for RPC
         * @param {Array} rpc.params params for RPC
         * @param {Function} [rpc.callback]
         * called this function when received response<br>
         * @param {Number} [rpc.timeout]
         * timeout time[ms], default 30000 ms
         * @see #event:response_callback
         */
         that.call_async = function(rpc) {
            msgid = (msgid == 0x0ffffffff) ? 0 : msgid + 1;
            if (!connected || typeof requests[msgid] !== 'undefined') {
                setTimeout(function() {
                               that.call_async(rpc);
                           }, 50);
                return;
            }
            send_request(msgid, rpc);
        };

        // initialize
        try {
            sock = new WebSocket(uri);   
        } catch (x) {
            return undefined;
        }
        sock.binaryType = 'arraybuffer';
        sock.onopen = function() {
            connected = true;
        };
        sock.onclose = sock.onerror = recv_event;
        sock.onmessage = recv_response;
        that.event_callback = event_callback;
        return that;
        /**
         * fire when received event message from a server
         * @name globalScope.msgpack.rpc.client#event_callback
         * @event
         * @param {Hash} e
         * @param {String} e.type type of event
         * [close, error, message]
         * @param {String} [e.method] method name
         * @param {Array} [e.params] arguments array that a server defines
         */
        /**
         * fire when received response
         * @name globalScope.msgpack.rpc.client#responce_callback
         * @event
         * @param {Hash} r
         * @param {String} r.error
         * error message from a server
         * @param {Object that you define} r.result
         * response object from a server
         */
    }
})(this);
