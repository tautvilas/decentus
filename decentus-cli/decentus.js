#!/usr/bin/env node

const localServer = false;
const serverUrl = localServer ? 'http://localhost:3000' : 'https://decentus.com';
const SERVER_API = serverUrl + '/api/domain/url';

const crypto = require('crypto');
const readlineSync = require('readline-sync');
const fs = require('fs');
const request = require('request-promise');
const infoMsg = `
Decentus Tools

Use one of the following commands:

generate-keys                                  - create a pair of private/public keys
sign-url [privateKeyFile] [url]                - sign url address with provided private key file
post-url [pubKeyDomain] [privateKeyFile] [url] - post signed url to decentus.com

In order to sucessufly post a url you have to add public key TXT record to your domain DNS config:

@ TXT pubkey=http://location-of-your-pub-key.com/id_rsa.pub
`;

function signUrl(privateKeyLocation, url) {
  const privateKey = fs.readFileSync(privateKeyLocation);

  const sign = crypto.createSign('SHA256');
  sign.update(url);
  sign.end();
  const answer = readlineSync.question(question, {hideEchoBack: true});
  const signature = sign.sign(crypto.createPrivateKey({key: privateKey, passphrase: answer || ''}), 'hex');
  return signature;
}

//console.log(process.argv);
command = process.argv[2];
const question = 'Enter passphrase for private key (press ENTER to skip): ';

if (command === 'generate-keys') {
  const answer = readlineSync.question(question, {hideEchoBack: true});
  const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      cipher: 'aes-256-cbc',
      passphrase: answer ? answer : '',
      format: 'pem'
    }
  });
  fs.writeFileSync('id_rsa', privateKey, {mode: 0o600});
  fs.writeFileSync('id_rsa.pub', publicKey, {mode: 0o666});
  console.log('id_rsa and id_rsa.pub keys were generated in this folder');
} else if (command === 'sign-url') {
  if (!process.argv[3]) {
    console.log('Please specify private key to sign with');
    return;
  }
  if (!process.argv[4]) {
    console.log('Please specify url to sign');
    return;
  }

  const signature = signUrl(process.argv[3], process.argv[4]);
  console.log(signature);

  /*
  const publicKey = fs.readFileSync('id_rsa.pub');
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(process.argv[4]);
  verify.end();
  console.log(verify.verify(crypto.createPublicKey(publicKey), signature, 'hex'));
  */
} else if (command === 'post-url') {
  (async () => {
    if (!process.argv[3]) {
      console.log('Please specify your domain name');
      return;
    }
    if (!process.argv[4]) {
      console.log('Please specify private file location');
      return;
    }
    if (!process.argv[5]) {
      console.log('Please specify url to sign');
      return;
    }
    const domain = process.argv[3].trim();
    const url = process.argv[5].trim();
    const signature = signUrl(process.argv[4], url);
    let res;
    try {
      //console.log(signature, url, domain);
      console.log('Submitting URL to ' + SERVER_API);
      res = await request({method: 'POST', uri: SERVER_API, body: {domain, signature, url}, json: true });
    } catch (e) {
      console.log(e.error);
      return;
    }
    console.log('The URL was submitted successfully! \n\nGo to your profile page at ' + serverUrl + '/u/domain/' + domain);
  })();
} else {
  console.log(infoMsg);
}

