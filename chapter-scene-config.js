/* x/y: viewport fractions; scale: relative to the approved right-hand slot.
   opacity fades the actor; background changes only the existing star layer. */
window.RESUME_CHAPTER_CONFIG = {
  timing: { response: 8, maxDeltaTime: .05, epsilon: .0005 },
  activationLine: .16,
  mobileBreakpoint: 760,
  sections: [
    { id:'top', selector:'.hero', label:'首屏', actor:'signature', x:.695, y:.54, scale:1, opacity:1, background:1,
      mobile:{x:.5,y:.81,scale:1,opacity:1,background:.70} },
    { id:'highlights', selector:'#highlights', label:'亮点', actor:'signature', x:.88,y:.55,scale:.55,opacity:.16,background:.40,
      mobile:{x:.72,y:.83,scale:.70,opacity:.08,background:.25} },
    { id:'projects', selector:'#projects', label:'作品', actor:'none', x:.88,y:.56,scale:.55,opacity:0,background:.20,
      mobile:{x:.72,y:.80,scale:.70,opacity:0,background:.14} },
    { id:'about', selector:'#about', label:'关于', actor:'portrait', x:.71,y:.53,scale:1,opacity:.94,background:.55,
      mobile:{x:.50,y:.74,scale:1.42,opacity:.85,background:.35} },
    { id:'experience', selector:'#experience', label:'经历', actor:'portrait', x:.87,y:.56,scale:.78,opacity:.15,background:.32,
      mobile:{x:.76,y:.82,scale:1,opacity:.06,background:.22} },
    { id:'skills', selector:'#skills', label:'技能', actor:'portrait', x:.91,y:.55,scale:.68,opacity:.07,background:.25,
      mobile:{x:.75,y:.85,scale:.88,opacity:.03,background:.17} },
    { id:'education', selector:'#education', label:'教育', actor:'portrait', x:.92,y:.56,scale:.65,opacity:.05,background:.22,
      mobile:{x:.76,y:.83,scale:.90,opacity:.02,background:.15} },
    { id:'credentials', selector:'#credentials', label:'证书', actor:'none', x:.92,y:.56,scale:.62,opacity:0,background:.16,
      mobile:{x:.76,y:.84,scale:.85,opacity:0,background:.12} },
    { id:'contact', selector:'#contact', label:'联系', actor:'none', x:.92,y:.59,scale:.58,opacity:0,background:.07,
      mobile:{x:.76,y:.85,scale:.80,opacity:0,background:.05} }
  ]
};
