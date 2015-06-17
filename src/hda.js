'use strict';

module.exports = HDAccount;
////////////////////////////////////////////////////////////////////////////////
var Bitcoin = require('bitcoinjs-lib');
var assert  = require('assert');
var Helpers = require('./helpers');
var KeyRing  = require('./keyring');

////////////////////////////////////////////////////////////////////////////////
// HDAccount Class

function HDAccount(object){

  var self = this;
  var obj = object || {};
  obj.cache = obj.cache || {};
  obj.address_labels = obj.address_labels || [];
  // serializable data
  this._label    = obj.label;
  this._archived = obj.archived || false;
  this._xpriv    = obj.xpriv;
  this._xpub     = obj.xpub;
  this._network  = obj.network || Bitcoin.networks.bitcoin;
  this._address_labels = [];
  obj.address_labels.map(function(e){self.setLabelForReceivingAddress(e.index,e.label);});

  // computed properties
  this._keyRing       = new KeyRing(obj.xpub, obj.cache);
  this._receiveIndex  = 0;
  this._changeIndex   = 0;
  this._n_tx          = 0;
  this._numTxFetched  = 0;
  this._balance       = null;
}

////////////////////////////////////////////////////////////////////////////////
// PUBLIC PROPERTIES

Object.defineProperties(HDAccount.prototype, {

  "label": {
    configurable: false,
    get: function() { return this._label;},
    set: function(str) {
      if(Helpers.isValidLabel(str))
        this._label = str;
      else
        throw 'Error: account.label must be an alphanumeric string';
    }
  },
  "archived": {
    configurable: false,
    get: function() { return this._archived;},
    set: function(value) {
      if(Helpers.isBoolean(value))
        this._archived = value;
      else
        throw 'Error: account.archived must be a boolean';
    }
  },
  "receiveIndex": {
    configurable: false,
    get: function() { return this._receiveIndex;},
    set: function(value) {
      if(Helpers.isNumber(value))
        this._receiveIndex = value;
      else
        throw 'Error: account.receiveIndex must be a number';
    }
  },
  "changeIndex": {
    configurable: false,
    get: function() { return this._changeIndex;},
    set: function(value) {
      if(Helpers.isNumber(value))
        this._changeIndex = value;
      else
        throw 'Error: account.changeIndex must be a number';
    }
  },
  "receivingAddressesLabels": {
    configurable: false,
    get: function() {
      var denseArray = [];
      this._address_labels
        .map(function(lab,ind){denseArray.push({"index": ind, "label": lab})});
      return denseArray;
    }
  },
  "extendedPublicKey": {
     configurable: false,
     get: function() { return this._xpub;},
   },
  "extendedPrivateKey": {
    configurable: false,
    get: function() { return this._xpriv;},
  },
  "keyRing": {
    configurable: false,
    get: function() { return this._keyRing;},
  },
  "receiveAddress": {
    configurable: false,
    get: function() { return this._keyRing.receive.getAddress(this._receiveIndex);},
  },
  "changeAddress": {
    configurable: false,
    get: function() { return this._keyRing.change.getAddress(this._changeIndex);},
  }
});

////////////////////////////////////////////////////////////////////////////////
// CONSTRUCTORS

HDAccount.exampleReadOnly = function(){
  return HDAccount.fromExtPublicKey("xpub6DHN1xpggNEUbWgGJyMPRFGvYm6pizUnv4TQMAtgYBikkh75dyp9Gf9QcKETpWZkLjtB4zYr2eVaHQ4g3rhj46Aeu4FykMWSayrqmRmEMEZ", "Example account");
};

HDAccount.example = function(){
  return HDAccount.fromExtPrivateKey("xprv9zJ1cTHnqzgBP2boCwpP47LBzjGLKXkwYqXoYnV4yrBmstmw6SVtirpvm4GESg9YLn9R386qpmnsrcC5rvrpEJAXSrfqQR3qGtjGv5ddV9g", "Example account");
};

/* BIP 44 defines the following 5 levels in BIP32 path:
 * m / purpose' / coin_type' / account' / change / address_index
 * Apostrophe in the path indicates that BIP32 hardened derivation is used.
 *
 * Purpose is a constant set to 44' following the BIP43 recommendation
 * Registered coin types: 0' for Bitcoin
 */
HDAccount.fromAccountMasterKey = function(accountZero, label){

  assert(accountZero, "Account MasterKey must be given to create an account.");
  var account    = new HDAccount();
  account.label  = label;
  account._xpriv = accountZero.toBase58();
  account._xpub  = accountZero.neutered().toBase58();
  account._keyRing.init(account._xpub, null);
  return account;
};

HDAccount.fromWalletMasterKey = function(masterkey, index, label) {

  assert(masterkey, "Wallet MasterKey must be given to create an account.");
  assert(Helpers.isNumber(index), "Derivation index must be an integer.");
  var accountZero = masterkey.deriveHardened(44).deriveHardened(0).deriveHardened(index);
  return HDAccount.fromAccountMasterKey(accountZero, label);
};

HDAccount.fromExtPublicKey = function(extPublicKey, label){
  // this is creating a read-only account
  assert(extPublicKey && extPublicKey[2] && extPublicKey[2] === "u"
      , "Extended public key must be given to create an account.");
  var accountZero = Bitcoin.HDNode.fromBase58(extPublicKey);
  var a = HDAccount.fromAccountMasterKey(accountZero, label);
  a._xpriv = null;
  return a;
};

HDAccount.fromExtPrivateKey = function(extPrivateKey, label){

  assert(extPrivateKey && extPrivateKey[2] && extPrivateKey[2] ==="r"
      , "Extended private key must be given to create an account.");
  var accountZero = Bitcoin.HDNode.fromBase58(extPrivateKey);
  return HDAccount.fromAccountMasterKey(accountZero, label);
};

////////////////////////////////////////////////////////////////////////////////
// JSON SERIALIZER

HDAccount.prototype.toJSON = function(){

  // should we add checks on the serializer too?
  var hdaccount = {
    label         : this._label,
    archived      : this._archived,
    xpriv         : this._xpriv,
    xpub          : this._xpub,
    address_labels: this.receivingAddressesLabels,
    cache         : this._keyRing
  };

  return hdaccount;
};

////////////////////////////////////////////////////////////////////////////////

HDAccount.prototype.incrementReceiveIndex = function() {
  this._receiveIndex++;
  return this;
};
////////////////////////////////////////////////////////////////////////////////
// address labels
HDAccount.prototype.setLabelForReceivingAddress = function(index, label) {
  assert(Helpers.isNumber(index), "Error: address index must be a number");
  assert(Helpers.isValidLabel(label), "Error: address label must be alphanumeric");
  this._address_labels[index] = label;
  return this;
}
HDAccount.prototype.getLabelForReceivingAddress = function(index) {
  assert(Helpers.isNumber(index), "Error: address index must be a number");
  return this._address_labels[index];
}

// var x = Blockchain.HDAccount.example();
// delete x._cache
// var j = JSON.stringify(x, null, 2);
// var xx = Blockchain.HDAccount.fromJSON(j);