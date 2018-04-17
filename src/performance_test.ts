//Performance comparison of Array.prototype.find() vs Map.prototype.get()

const MAX: number = 10000000
const test = new Array()
const map = new Map()

function initial_array(){
    for(let i=0;i<MAX;i++){
        test.push(i)
    }
}

function initial_map(){
    for(let i=0;i<MAX;i++){
        map.set(i.toString(), i.toString())
    }
}

initial_array()
initial_map()

let target = Math.round(Math.random()*MAX)
console.log('target number is: ' + target)

let init_array_start = Date.now()
test.find((element)=>element == target)
let init_array_end = Date.now()
console.log('Array find: ' + (init_array_end-init_array_start))

let init_map_start = Date.now()
map.get(target.toString())
let init_map_end = Date.now()
console.log('Map get: ' + (init_map_end-init_map_start))


// target number is: 9420784
// Array find: 341
// Map get: 0
