export const houseTitle = '野原家的小屋';
export const houseLocation = '埼玉县 · 春日部';
export const houseOrbitHint = '拖动旋转';

export const rooms = [
  { id: 'exterior', label: '外观', title: '屋外的小院', floor: '室外', color: 0xb85541 },
  { id: 'living', label: '客厅', title: '一家人的客厅', floor: '一楼', color: 0xa45a39 },
  { id: 'kitchen', label: '厨房', title: '厨房与餐桌', floor: '一楼', color: 0x4f7254 },
  { id: 'tatami', label: '和室', title: '榻榻米和室', floor: '一楼', color: 0x657340 },
  { id: 'kids', label: '儿童房', title: '玩具与故事书', floor: '二楼', color: 0x92613b },
  { id: 'bath', label: '浴室', title: '浴室', floor: '一楼', color: 0x43767d }
] as const;

export type RoomId = typeof rooms[number]['id'];
