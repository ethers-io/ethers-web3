var ethers = (function() {
    // If you don't wish to inject web3 here, simply include it with a <script> tag

    // Begin Web3
    // REPALCE WITH WEB3
    // End Web3

    var Web3 = require('web3');

    function EthersProvider(testnet) {
        this._nextMessageId = 1;
        this._callbacks = {};
        this._ws = null;

        // @TODO: Add redundant hosts
        if (testnet) {
            this._endpoint = 'wss://morden-virginia-1.ethers.ws/v1/morden';
        } else {
            this._endpoint = 'wss://homestead-virginia-1.ethers.ws/v1/homestead';
        }

        //this._endpoint = 'ws://localhost:8001/v1/morden';

        // Backlog of sends requested while we were not conneted
        this._pending = [];

        this._connected = false;
        this._connect();
    }

    // @TODO: instead of this, move all callbacks to pending and attempt reconnect
    EthersProvider.prototype._purgeCallbacks = function() {
        for (var messageId in self._callbacks) {
            try {
                callback = self._callbacks[messageId](error);
            } catch (error) { }
        }
        self._callbacks = {};
    }

    EthersProvider.prototype._connect = function() {
        this._ws = new WebSocket(this._endpoint);

        var self = this;
        this._ws.onopen = function() {
            self._connected = true;

            // Send all pending requests
            for (var i = 0; i < self._pending.length; i++) {
                //console.log('>>>', self._pending[i]);
                self._ws.send(self._pending[i]);
            }
            self._pending = [];
        };

        this._ws.onmessage = function(message) {
            var payload = null;
            //console.log('<<<', message.data);

            var callback = function() { };
            try {
                message = JSON.parse(message.data);

                // Serious connetion error (unrecoverable)
                if (message.id === 0) {
                    payload = JSON.parse(message.payload);
                    if (payload.data.expectedNetwork) {
                        throw new Error('network mismatch: server=' + payload.data.expectedNetwork + ', client=' + payload.data.network);
                    }
                    if (payload.data.invalidPath) {
                        throw new Error('invalid API path: ' + payload.data.invalidPath);
                    }
                    throw new Error('server error');
                }

                // Get the callback
                callback = self._callbacks[message.id];
                delete self._callbacks[message.id];

            } catch (error) {

                // Notify all callbacks we have failed
                self._purgeCallbacks();
                return;
            }

            // Parse the result
            try {
                payload = JSON.parse(message.payload);
            } catch (error) {
                callback(new Error('Invalid JSON RPC response: ' + message.payload));
                return;
            }

            // Call the callback with the result
            callback(null, payload);
        };

        this._ws.onerror = function(error) {
            console.log('webocket error: ' + error.message);
            this._connected = false;
        };

        this._ws.onclose = function() {
            this._connected = false;
        }
    }

    EthersProvider.prototype.send = function(payload) {
        function respond(result) {
            return {id: payload.id, jsonrpc: '2.0', result: result};
        }

        switch (payload.method) {
            case 'eth_syncing': return respond(false);
            case 'eth_coinbase': return respond(null);
            case 'eth_hashrate': return respond(0);
            case 'eth_accounts': return respond([]);
            case 'eth_mining': return respond(false);
        }

        //console.log('sync', payload.method);

        throw new Error('ethers.io does not support synchronous calls.');
    }

    EthersProvider.prototype.sendAsync = function(payload, callback) {
        function respond(error, result) {
            setTimeout(function() {
                if (error) {
                    callback(error);
                } else {
                    callback(null, {id: payload.id, jsonrpc: '2.0', result: result});
                }
            }, 0);
        }

        switch (payload.method) {
            case 'eth_syncing': return respond(null, false);
            case 'eth_coinbase': return respond(null, null);
            case 'eth_hashrate': return respond(null, 0);
            case 'eth_accounts': return respond(null, []);
            case 'eth_mining': return respond(null, false);
            case 'eth_sendTransaction': return respond(new Error('ethers.io does not have accounts'));
            case 'eth_sign': return respond(new Error('ethers.io does not have accounts'));
        }
        //console.log('async', payload.method);

        var messageId = (this._nextMessageId++);
        this._callbacks[messageId] = callback;

        payload = JSON.stringify({id: messageId, payload: JSON.stringify(payload)});
        if (this._connected) {
            //console.log('>>>', payload);
            this._ws.send(payload);
        } else {
            this._pending.push(payload);
        }
    }

    EthersProvider.prototype.isConnected = function() {
        return this._connected;
    }

    function connect(testnet) {
        var web3 = new Web3(new EthersProvider(testnet));

        // @TODO: We will need hijack eth.filter here

        return web3;
    }

    function Library() {
        Object.defineProperty(this, 'EthersProvider', {
            value: EthersProvider
        });

        Object.defineProperty(this, 'web3', {
            value: Web3
        });

        Object.defineProperty(this, 'connect', {
            value: connect,
        });
    }

    return new Library();
})();
