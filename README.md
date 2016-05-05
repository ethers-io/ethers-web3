ethers-web3
===========

This is the beginning of the *ethers.io* web3.

More coming soon.


Features
--------

* Complete web3 object
* No need to install your own *Ethereum* nodes


Intalling
---------

To use on your own website, simply include the script:

```html
<script type="text/javascript" src="https://ethers.io/static/ethers-web3-bc3788a20bb49f2b.js"></script>
```


To Do
-----

* Automatically reconnect
* Filters
* Inject private keys and addresses into the ethers object as accounts


API
---

The `ethers` object handles connecting to a Ethereum node for you, over an efficient WebSocket.

```javascript
    // Connect to mainnet (homestead)
    var web3 = ethers.connect();

    // Connect to testnet (morden)
    var web3 = ethers.connect({testnet: true});

    // Connect to your own ethers-server (example: morden)
    var web3 = ethers.connect({endpoints: ['ws://localhost:8001/v1/morden']});
```


Synchronous Calls
-----------------

Any call that must actually call the server cannot be synchronous, as WebSockets do not support them.

In general they are a bad idea for any task that could have a non-trivial running time. They prevent your user interface from updating and cause non-ideal user experiences.

Friends don't let friends call synchronously.


License
-------

MIT License.



