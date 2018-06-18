import * as Web3 from "web3"
import { BigNumber } from 'bignumber.js';

const hdkey = require('ethereumjs-wallet/hdkey')
const utils = require("ethereumjs-util")
const etheTx = require('ethereumjs-tx')
const bip39 = require('bip39')

let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

// mnemonic to generate "from seed"
const fromMEM: string = "maze ocean slab maximum sleep potato candy antique hammer parrot unable east"
// mnemonic to generate "to seed"
const toMEM: string = "people volume drive live mesh shrug message pudding rain snow hip cloth"
// store "from wallet" (object) from "from mnemonic"
let fromWallets: any[]
// store "to wallet" from " to mnemonic", just need 1 wallet
let toWallet: any
// store "to address"
let toAddress: string
// store all balances 
let balanceTotal: BigNumber = new BigNumber(0)

let timer: NodeJS.Timer

async function main() {


    if (!web3.isConnected()) {
        throw new Error("Could not connect web3");
    }
    console.log(`Connected successfully to '${web3.version.node}'`)

    // generate ETH address indexed [start, end]
    const limit = 10
    const start = 0
    const end = start + limit - 1

    initWallet(fromMEM, start, end, toMEM)

    // // sum up balance at database
    // await balanceLoop(fromWallets, start, limit, 0)

    // send balance of each account to a single account
    await transferLoop(fromWallets, toAddress, start, limit, 0)

}

async function balanceLoop(fromWallets:Array<any>, start: number, limit: number, index: number){
    if(index === limit){
        return
    }
    await requestBalance(fromWallets, start, index)
    setTimeout(()=>balanceLoop(fromWallets, start, limit, index+1), 100)
}
async function transferLoop(fromWallets:Array<any>, toAddress:string, start: number, limit: number, index: number){
    if(index === limit){
        return
    }
    await requestBalanceAndSend(fromWallets, toAddress, start, index)
    setTimeout(()=>transferLoop(fromWallets, toAddress, start, limit, index+1), 5000)
}
function initWallet(fromMEM: string, start: number, end: number, toMEM: string) {
    //'from' wallets
    fromWallets = []
    const fromDeriveRoot = getDeriveRoot(fromMEM)
    console.log(`From Mnemonic: ${fromMEM}`)
    for(let i=start;i<end+1;i++){
        fromWallets.push(fromDeriveRoot.deriveChild(i).getWallet())
        // console.log(`${i}: ${utils.addHexPrefix(fromWallets[i].getAddress().toString('hex'))}`)
    }
    console.log(`Made ${end-start+1} wallets: child[${start} ~ ${end}]`) 
    //'to' wallet 
    //const toMEM = bip39.generateMnemonic()
    const toDeriveRoot = getDeriveRoot(toMEM)
    console.log(`To Mnemonic: ${toMEM}`)
    toWallet = toDeriveRoot.deriveChild(0).getWallet()
    toAddress = utils.addHexPrefix(toWallet.getAddress().toString('hex'))
    console.log(`Made receive wallet: ${toAddress}`)
}

function getDeriveRoot(mnemonic:string){
    const BIP44_PATH = 'm/44\'/60\'/0\'/0';
    let seed = bip39.mnemonicToSeed(mnemonic)
    let hdWallet = hdkey.fromMasterSeed(seed)
    let derivePath = hdWallet.derivePath(BIP44_PATH)
    return derivePath
}

function requestBalance(fromWallets:Array<any>, start: number, index: number) {
    let fromWallet = fromWallets[index]
    let fromAddr = utils.addHexPrefix(fromWallet.getAddress().toString('hex'))

    let balance: BigNumber = web3.eth.getBalance(fromAddr)

    if (!balance.isZero()) {
        balanceTotal = balanceTotal.plus(balance)
    }
    console.log(start+index + ': Address: ' + fromAddr)
    console.log('   Balance: ' + balance)
    console.log(`   Tatal Balance: ${balanceTotal} Wei`)
    const ethTotal = web3.fromWei(balanceTotal, 'ether')
    console.log(`   Tatal Balance: ${ethTotal} ETH`)
}

async function requestBalanceAndSend(fromWallets:Array<any>, toAddress:string, start: number, index: number) {
    let fromWallet = fromWallets[index]
    let fromAddr = utils.addHexPrefix(fromWallet.getAddress().toString('hex'))
        
    let balance: BigNumber = web3.eth.getBalance(fromAddr)

    if (!balance.isZero()) {
        let gasLimit = 21000
        // 1 Gwei
        const gwei = 1000000000;
        // Check current network gasPrice @ https://ethgasstation.info/
        let gasPrice = 5 * gwei;
        let transfer = balance.minus(gasPrice * gasLimit)
        let nonce = web3.eth.getTransactionCount(fromAddr)

        // console.log(`from Addreess is: ${fromAddr}`)
        // console.log(`nonce is: ${nonce}`)
        // console.log(`balance is: ${balance}`)
        // console.log(`transfer amount is: ${transfer}`)
        // console.log(`gasPrice is: ${gasPrice}`)
        // console.log(`gasLimit is : ${gasLimit}`)
        // console.log('0x'+ transfer.toString(16))
        // console.log('0x'+ gasPrice.toString(16))
        // console.log('0x'+ gasLimit.toString(16))

        const txParams = {
            nonce: '0x'+ nonce.toString(16),
            gasPrice: '0x'+ gasPrice.toString(16),
            gasLimit: '0x'+ gasLimit.toString(16),
            to: toAddress,
            value: '0x'+ transfer.toString(16),
            chainId: '0x01'
        }
        const tx = new etheTx(txParams)
        tx.sign(fromWallet.getPrivateKey())
        const serializedTx = tx.serialize()
        console.log(`${start+index}: ${fromAddr} has balance ${balance.toNumber()} Wei`)
        console.log(`${start+index}: Raw Tx: 0x${serializedTx.toString('hex')}`)
        
        let hash: string
        hash = await new Promise<string>((resolve, reject)=>{
            web3.eth.sendRawTransaction('0x'+serializedTx.toString('hex') , (err, hash)=>{
                if(!err)
                {                
                    console.log(`${start+index}: Tx hash is: ${hash}, from ${fromAddr} sent ${transfer} Wei to ${toAddress} with gas fee: ${gasPrice/gwei} GWei and gas limit: ${gasLimit}`)
                    resolve(hash)
                }
                else{
                    console.log(`${err}`)
                    reject(err)
                }
            })
        })
        const receipt = web3.eth.getTransactionReceipt(hash)
        if(receipt.status === "0x1"){
            console.log(`${start+index}: Tx successful with hash: ${hash} - blockHash: ${receipt.blockHash} - gasused: ${receipt.gasUsed} - cumulativeGasUsed: ${receipt.cumulativeGasUsed}`)
        } else {
            console.log(`${start+index}: Tx failed with hash: ${hash}`)
        }
    }
    else {
        console.log(`${start+index}: ${fromAddr} has no ETH`)
    }
    
}

main().catch((e) => {
    console.log(e)
})
