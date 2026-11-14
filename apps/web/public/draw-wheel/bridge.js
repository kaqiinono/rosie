// Credentials remain in the React host. Accept replies only from that exact parent and origin.
const pending = new Map();
const origin = window.location.origin;
export function signal(type, data = {}) { window.parent.postMessage({ channel: 'rosie-draw-v1', type, ...data }, origin); }
window.addEventListener('message', event => {
  if (event.source !== window.parent || event.origin !== origin || event.data?.channel !== 'rosie-draw-v1' || event.data.type !== 'response') return;
  const task = pending.get(event.data.id);
  if (!task) return;
  clearTimeout(task.timer);
  pending.delete(event.data.id);
  if (event.data.error) task.reject(new Error(event.data.error));
  else task.resolve(event.data.value);
});
function send(type, data) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('请求未能确认，请重新读取奖池和历史记录后再继续。'));
    }, type === 'confirm' ? 30 * 60 * 1000 : 60000);
    pending.set(id, { resolve, reject, timer });
    signal(type, { id, ...data });
  });
}
export function request(command) { return send('request', { command }); }
export function confirmAction(action, name = '') { return send('confirm', { action, name }); }
