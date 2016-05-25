var ethers = (function() {
    // If you don't wish to inject web3 here, simply include it with a <script> tag

    // Begin Web3
    // REPLACE-WITH-WEB3
    // End Web3

    var fetchUrl = function(url) {
        return (new Promise(function(resolve, reject) {
            var request = new XMLHttpRequest();
            request.open('GET', url, true);

            request.onload = function() {
                if (request.status >= 200 && request.status < 400) {
                    resolve(request.responseText);
                } else {
                    reject('server error - ' + request.status)

                }
            };

            request.onerror = function() {
                reject('connection error');
            };

            request.send();
        }));
    }

    var Web3 = require('web3');

    var sha3 = Web3.prototype.sha3;

    function EthersProvider(options, callback) {

        // They are actually passing in null options, and a callback
        if (typeof(options) === 'function' && !callback) {
            callback = options;
            options = {};
        }

        if (!options) { options = {}; }
        if (!callback) { callback = function() { }; }

        this._callback = callback;

        this._nextMessageId = 1;

        // Maps messageId to callback (null if fatal error has occurred)
        this._callbacks = {};

        // Backlog of requests prior to connection (null after drained)
        this._pending = [];

        // Maps filterId to array of queued response
        this._filterResponses = {};

        this._ws = null;

        // Custom endpoints
        if (options.endpoints) {
            this._endpoints = options.endpoints;

        // Testnet
        } else if (options.testnet) {
            this._endpoints = [
               'wss://morden-virginia-1.ethers.ws/v1/morden',
               'wss://morden-virginia-2.ethers.ws/v1/morden',
            ];

        // Homestead
        } else {
            this._endpoints = [
                'wss://homestead-virginia-1.ethers.ws/v1/homestead',
            ];
        }

        this._connect();
    }

    EthersProvider.prototype._connect = function() {
        if (this._ws) {
            if (this._callbacks === null) {
                throw new Error('fatal error');
            }
            throw new Error('already connected');
        }

        // Connect to a random endpoint
        this._endpoint = this._endpoints[parseInt(Math.random() * this._endpoints.length)]
        this._ws = new WebSocket(this._endpoint);

        var self = this;
        this._ws.onopen = function() {

            // Send all pending requests
            for (var i = 0; i < self._pending.length; i++) {
                //console.log('d >>>', self._pending[i]);
                self._ws.send(self._pending[i]);
            }
            self._pending = null;
        };

        this._ws.onmessage = function(message) {
            if (self._callbacks === null) {
                //console.log('draining messages; we are destroyed');
                //console.log(message);
                return;
            }
            var payload = null;
            //console.log('<<<', message.data);

            // Get the callback to pass the result to
            var callback = null;
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

                if (message.id) {
                    // Get the callback for the message
                    callback = self._callbacks[message.id];
                    delete self._callbacks[message.id];

                } else if (message.filterId) {
                    var filterId = message.filterId;
                    callback = function(error, result) {
                        var filterResponses = self._filterResponses[filterId];
                        if (!filterResponses) {
                            filterResponses = [];
                            self._filterResponses[filterId] = filterResponses;
                        }
                        filterResponses.push({error: error, result: result});
                    }
                }

            } catch (error) {

                // Notify all callbacks we have failed
                self._ws.close();
                return;
            }

            // No callback; this probably shouldn't happen
            if (!callback) { callback = function() { }; }

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
            self._ws.close();
        };

        this._ws.onclose = function() {
            var error = new Error('connection closed');

            for (var messageId in self._callbacks) {
                try {
                    callback = self._callbacks[messageId](error);
                } catch (error) { }
            }
            self._callbacks = null;

            self._callback(error);
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

        throw new Error('ethers.io does not support synchronous calls.');
    }

    EthersProvider.prototype.sendAsync = function(payload, callback) {

        // Pacakge a JSON-RPC error
        function makeError(message) {
            return {code: -32603, message: 'internal error', data: {message: message}};
        }

        var self = this;

        // If this is a batch request, de-batch-ify it
        if (Array.isArray(payload)) {
            var work = [];
            for (var i = 0; i < payload.length; i++) {
                work.push((function(payload) {
                    return new Promise(function(resolve, reject) {
                        self.sendAsync(payload, function(error, result) {
                            if (error) {
                                resolve(makeError(error));
                            } else {
                                resolve(result);
                            }
                        });
                    });
                })(payload[i]));
            }

            Promise.all(work).then(function(results) {
                callback(null, results);
            }, function(reason) {
                console.log('Something terrible happend.', reason);
            });

            return;
        }

        // Package up a JSON-RPC reponse
        function respond(error, result) {
            setTimeout(function() {
                if (error) {
                    callback(null, makeError(error.message));
                } else {
                    callback(null, {id: payload.id, jsonrpc: '2.0', result: result});
                }
            }, 0);
        }

        // We are disconnected from the server
        if (this._callbacks === null) {
            return respond(new Error('server disconnected'));
        }

        // Some things we can "handle" synchronously (respond still response async)
        switch (payload.method) {
            case 'eth_syncing': return respond(null, false);
            case 'eth_coinbase': return respond(null, null);
            case 'eth_hashrate': return respond(null, 0);
            case 'eth_accounts': return respond(null, []);
            case 'eth_mining': return respond(null, false);
            case 'eth_sendTransaction': return respond(new Error('ethers.io does not have accounts'));
            case 'eth_sign': return respond(new Error('ethers.io does not have accounts'));

            // When a filter response, it queues its response for the next of these
            case 'eth_getFilterLogs':
            case 'eth_getFilterChanges':
                var filterId = payload.params[0];
                var responses = this._filterResponses[filterId];
                if (!responses) { return; }

                var result = [];

                // @TODO: what if there was an error?
                for (var j = 0; j < responses.length; j++) {
                    var response = responses[j];
                    if (responses.error) {
                        console.log('What should I do?!')
                        continue;
                    }
                    result.push(response.result);
                }
                delete this._filterResponses[filterId]

                return respond(null, result);
        }

        // Register the callback for this response
        var messageId = (this._nextMessageId++);
        this._callbacks[messageId] = callback;

        payload = JSON.stringify({id: messageId, payload: JSON.stringify(payload)});

        // If we haven't successfully connected yet, we buffer the request until we connect
        if (this._pending !== null) {
            this._pending.push(payload);

        } else {
            //console.log('i >>>', payload);
            this._ws.send(payload);
        }
    }

    EthersProvider.prototype.isConnected = function() {
        return (this._callbacks !== null);
    }


    function Contract(source, bytecode, compilerVersion, optimize, depoymentTarget) {
          this._source = source;
          this._bytecode = bytecode;
          this._compilerVersion = compilerVersion;
          this._optimize = optimize;
          this._deploymentTarget = depoymentTarget;
    }


    function Ethers(web3) {
        this._web3 = web3;
    }

    Ethers.prototype._callEthers = function(method, parameters, callback) {
        return this._web3._requestManager.sendAsync({method: method, params:parameters}, callback);
    }

    // callback is optional
    //Ethers.prototype.faucet = function(address, callback) {
    //    if (!callback) { callback = function() { }; }
    //    // @TODO: Check valid address
    //    return this._callEthers('ethers_faucet', [address], callback);
    //};

    // @TODO: Once we have accounts
    //Ethers.prototype.deployContract = function(source, compilerVersion, optimize, deploymentTarget, account) {
    //};
    function populateContractInfo(contractInfo, callback) {
        if (!contractInfo || !contractInfo.source || !contractInfo.source.url) {
            setTimeout(function() { callback(null, contractInfo); }, 0);
            return;
        }

        Promise.all([
            fetchUrl(contractInfo.source.url),
            fetchUrl(contractInfo.interfaces.url),
        ]).then(function(results) {

            // Check the content hasn't been tampered with
            if ('0x' + sha3(results[0]) !== contractInfo.source.hash) {
                callback(new Error('source hash mismatch'));
                return;
            }
            if ('0x' + sha3(results[1]) !== contractInfo.interfaces.hash) {
                callback(new Error('interface hash mismatch'));
                return;
            }

            var info = {
                address: contractInfo.address,
                bytecode: contractInfo.bytecode,
                compilerVersion: contractInfo.compilerVersion,
                deploymentTarget: contractInfo.deploymentTarget,
                gistId: contractInfo.gistId,
                interfaces: JSON.parse(results[1]),
                optimized: contractInfo.optimized,
                source: results[0],
                urls: {
                    source: contractInfo.source.url,
                    interfaces: contractInfo.interfaces.url,
                },
            }

            callback(null, info);
        }, function(error) {
            callback(error);
        });
    }

    Ethers.prototype.deploySignedContract = function(options, callback) {
        var self = this;

        return this._callEthers('ethers_deployContract', [
            options.source,
            options.compilerVersion,
            options.optimize,
            options.deploymentTarget,
            options.signedTransaction
        ], function (error, contractInfo) {
            if (error) {
                return callback(error);
            }

            callback(null, contractInfo);
        });
    }

    Ethers.prototype.getContract = function(address, callback) {
        return this._callEthers('ethers_getContract', [address], function (error, contractInfo) {
            if (error) {
                return callback(error);
            }

            populateContractInfo(contractInfo, callback);
        });
    }

    /*
    Ethers.prototype.starFilter = function() {
        this._callEthers('ethers_startFilter', [], callback);
    }

    Ethers.prototype.stopFilter = function() {
        this._callEthers('ethers_stopFilter', [], callback);
    }
    */


    function addEthersMethods(web3) {

        // We got an instance of the web3 Object
        if (web3.setProvider) {
            Object.defineProperty(web3, 'ethers', {
                value: new Ethers(web3)
            });

            // Add the EthersProvider to the web3
            web3.constructor.providers.EthersProvider = EthersProvider;

        } else {
            // @TODO: Handle populating the Web3 object
            //web3.prototype.ethers = new Ethers()
            //web3.providers.EthersProvider = EthersProvider;

            throw new Error('addEtherMethods requires an instance of Web3');
        }


        return web3;
    }


    function connect(options, callback) {
        return addEthersMethods(new Web3(new EthersProvider(options, callback)));
        /*
        var web3 = addEthersMethods(new Web3(new EthersProvider(options, function(error) {
            if (error) { web3 = null; }
            callback(error, web3);
        })));
        return web3;
        */
    }


    function Library() {
        Object.defineProperty(this, 'EthersProvider', {
            value: EthersProvider,
        });

        Object.defineProperty(this, 'web3', {
            value: Web3,
        });

        Object.defineProperty(this, 'connect', {
            value: connect,
        });

        Object.defineProperty(this, 'addEthersMethods', {
            value: addEthersMethods,
        });
    }

    return new Library();
})();
