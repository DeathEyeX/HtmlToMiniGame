export function reportStartupError(tag: string, title: string, error: unknown) {
  console.error(`${tag} ${title}`, error);
  wx.showModal({ title, content: String(error), showCancel: false });
}
