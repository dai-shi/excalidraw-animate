import{Commands as e,subsetToBinary as t}from"./subset-shared.chunk-N6JspAW-.js";import"./index-wGD7c8XB.js";var m=import.meta.url?new URL(import.meta.url):void 0;typeof window>"u"&&typeof self<"u"&&(self.onmessage=async a=>{switch(a.data.command){case e.Subset:let s=await t(a.data.arrayBuffer,a.data.codePoints);self.postMessage(s,{transfer:[s]});break}});export{m as WorkerUrl};
