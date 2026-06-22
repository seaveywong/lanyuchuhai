export function ceilToHalf(v){return(Math.ceil(parseFloat(v)*2)/2).toFixed(1)}
export function cnyToUsdt(cny,rate=7){return ceilToHalf(parseFloat(cny)/rate)}
