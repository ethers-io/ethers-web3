ethers-web3
===========

This is the beginning of the *ethers.io* web3.

More coming soon.


Features
--------

* Complete web3 object
* No need to install your own *Ethereum* nodes; we do that for you


Intalling
---------

To use on your own website, simply include the script:

```html
<script type="text/javascript" src="https://ethers.io/static/ethers-web3-019aab22c5fac0ab.js"></script>
```


To Do
-----

* Automatically reconnect option (will have to deal with filters in weird ways, so application support for reconnect may be required regardless)
* Inject private keys and addresses into the `ethers` object as accounts
* Re-write the parts of *web3* that *ethers-web3* requires to remove the LGPL tendrils


Notes
-----

* Filter support is new and may have issues; please let us know if you find any problems and reproduction steps if possible


API
---

The `ethers` object handles connecting to a *Ethereum* node for you, over an efficient WebSocket.

```javascript
    // Connect to mainnet (homestead)
    var web3 = ethers.connect();

    // Connect to testnet (morden)
    var web3 = ethers.connect({testnet: true});

    // Connect to your own ethers-server (example: morden)
    var web3 = ethers.connect({endpoints: ['ws://localhost:8001/v1/morden']});

    // Connect with a normal/modified web3 installation
    var web3 = new Web3(ethers.EthersProvider({testnet: true}));
```


Synchronous Calls
-----------------

Any call that must actually call the server cannot be synchronous, as WebSockets do not support them.

In general they are a bad idea for any task that could have a non-trivial running time. They prevent your user interface from updating and cause non-ideal user experiences.

Friends don't let friends call synchronously.


License
-------

The *ethers* library is released under the MIT License.

The *web3* library is available under the LGPL-3.0 license. This should not affect you unless you modify the source of the embedded web3, in which case those (and only those) changes are swept into the LGPL-3.0 license.



