export const roomSpecs = [
  {id:"04A",name:"温室",level:3,side:-1,color:0xd2ce8b,close:true,note:"弧形玻璃罩、育苗架、滴灌和移栽工作台。"},
  {id:"04B",name:"医务室",level:3,side:1,color:0xffbd8b,close:true,note:"护理床、输液架、急救柜和床边照明。"},
  {id:"03A",name:"厨房",level:2,side:-1,color:0xffc180,note:"炉台和备餐桌，靠近主梯补给。"},
  {id:"03B",name:"生活舱",level:2,side:1,color:0xffc48e,note:"船员用餐和休息的公共空间。"},
  {id:"02A",name:"净水舱",level:1,side:-1,color:0xd4c092,note:"储水罐和贯穿楼层的检修管路。"},
  {id:"02B",name:"储备舱",level:1,side:1,color:0xffbd73,note:"食品、零件与备用电源。"},
  {id:"01A",name:"维修舱",level:0,side:-1,color:0xffc282,note:"工作台与常用备件，前方连通船首。"},
  {id:"01B",name:"泵组机舱",level:0,side:1,color:0xffb86d,note:"主泵、阀轮、压力表和管路。"},
];

export function crewOnWatch(roof: number) {
  return [
  {art:"angler",name:"甲板渔夫",job:"船首舷边垂钓",x:-2.92,z:1.43,y:roof+.016,h:1.42},
  {art:"gardener",name:"温室园丁",job:"育苗与灌溉",room:"04A",x:-1.37,z:3.04,h:1.40},
  {art:"medic",name:"值班医护",job:"处理伤口与换药",room:"04B",x:2.17,z:3.10,h:1.35},
  {art:"cook",name:"炊事员",job:"炉前备餐",room:"03A",x:-4.07,z:2.83,h:1.38},
  {art:"reader",name:"领航员",job:"校对海图",room:"03B",x:3.72,z:2.72,h:1.17},
  {art:"fitter",name:"净水工",job:"检查过滤罐",room:"02A",x:-2.46,z:2.99,h:1.10,flip:true},
  {art:"reader",name:"物资管理员",job:"清点备用电源",room:"02B",x:3.53,z:2.80,h:1.17,flip:true},
  {art:"reader",name:"维修工",job:"核对零件图纸",room:"01A",x:-3.67,z:2.71,h:1.15,flip:true},
  {art:"fitter",name:"轮机员",job:"检修主循环泵",room:"01B",x:1.31,z:2.69,h:1.02}
];
}
