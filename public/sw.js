
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ includeUncontrolled: true });
    let chatClient = allClients.find(c => c.url.includes('/') && 'focus' in c);
    if (chatClient) {
      chatClient.focus();
    } else {
      clients.openWindow('/');
    }
  })());
});
