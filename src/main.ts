import * as Web3 from "web3"
import { BigNumber } from 'bignumber.js';
import * as mysql from "mysql"


let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let db = mysql.createConnection({
    host: 'localhost',
    user: 'infinity',
    password: 'wGt#X%d13t!!daoS%6pytOP8J75PLIAP',
    database: 'infinity'
});

let txInsertCount = 0
function insertTx(txid: string, address: string, amount: BigNumber | Number) {
    let sql = "INSERT INTO `input_transactions` (`tx_hash`, `address`, `tx_amount`) VALUES (?,?,?);"
    db.query(sql, [txid, address, amount], (error, results, fields) => {
        if (error) {
            console.log(`Failed to insert TXID ${txid}, ${address}, ${amount}: ${error}`)
        } else {
            txInsertCount++
        }
    })

}


let timerId: NodeJS.Timer;
let address = "0x390dE26d772D2e2005C6d1d24afC902bae37a4bB"
address = "0xFBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98"
async function main() {
    await new Promise((resolve, reject) => {
        db.connect((err) => {
            if (err) {
                reject(err)
            } else {
                console.log(`Connected to db, id: '${db.threadId}'`)
                resolve()
            }
        })
    })

    if (!web3.isConnected()) {
        throw new Error("Could not connect");
    }

    console.log(`Connected successfully to '${web3.version.node}'`)


    web3.eth.getSyncing(printSync)
    let balance = web3.eth.getBalance(address);
    console.log(`'${address}': ${web3.fromWei(balance, "ether")} Eth`)

    let sub = web3.eth.filter("latest");
    sub.watch((err, result) => {
        if (err) {
            console.log(err)
        }
        if (typeof result == 'string') {
            let block = web3.eth.getBlock(result)
            console.log(`Block #${block.number}: ${block.hash} ${block.transactions.length}`)
            for (let i = 0; i < block.transactions.length; i++) {
                let tx = web3.eth.getTransactionFromBlock(result, i)
                if (true || tx.from == address || tx.to == address) {
                    console.log(`TX# ${tx.from} -- ${web3.fromWei(tx.value, 'ether')} --> ${tx.to}`)
                    insertTx(tx.hash, tx.from, web3.fromWei(tx.value, 'ether'))
                }
                break;
            }
        } else {
            console.log(result)
        }
    })

    // let sub2 = web3.eth.filter({ address: '0xFBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98' });
    // sub2.watch((err, result) => {
    //     console.log(`${result.blockNumber}: ${result.transactionHash} ${result.topics.join(", ")}`)
    // })
}

function printSync(err: Error, res: Web3.SyncingResult) {
    if (err) {
        console.log(err)
        clearInterval(timerId)
    }
    if (res === false) {
        console.log(`Sync complete`)
        clearInterval(timerId)
    } else {
        if (timerId === undefined) {
            setInterval(() => web3.eth.getSyncing(printSync), 1000)
        }
        console.log(`Sync: ${res.currentBlock} / ${res.highestBlock} (${100 * res.currentBlock / res.highestBlock}%)`)
        console.log(`TXs inserted: ${txInsertCount}`)
        let balance = web3.eth.getBalance(address);
        console.log(`'${address}': ${web3.fromWei(balance, "ether")} Eth`)

    }
}



main().catch((e) => {
    db.end();
})
