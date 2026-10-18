// Keep anchor targets below the menu, including its two-row mobile layout.
const header=document.querySelector('body>header');
if(header&&'ResizeObserver' in window)new ResizeObserver(()=>{
 document.documentElement.style.setProperty('--navigation-height',Math.ceil(header.getBoundingClientRect().height)+'px');
}).observe(header);
