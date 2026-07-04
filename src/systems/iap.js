/* Neon Strike — In-app purchase mock store */
'use strict';

window.NeonIAP = (function () {
  const products = [
    { id: 'remove_ads',     type: 'non-consumable', price: '$4.00', title: 'Remove Ads' },
    { id: 'skin_fire',      type: 'non-consumable', price: '$2.00', title: 'Fire Ball' },
    { id: 'skin_ice',       type: 'non-consumable', price: '$2.00', title: 'Ice Ball' },
    { id: 'skin_galaxy',    type: 'non-consumable', price: '$3.00', title: 'Galaxy Ball' },
    { id: 'skin_chrome',    type: 'non-consumable', price: '$3.00', title: 'Chrome Ball' },
    { id: 'coin_pack_small', type: 'consumable',    price: '$1.00', title: '100 Stars' },
  ];

  const owned = new Set();

  function getProducts() { return products.map(p => ({ ...p, owned: owned.has(p.id) })); }

  function purchase(id, cb) {
    const p = products.find(x => x.id === id);
    if (!p || owned.has(id)) { if (cb) cb(false); return; }
    setTimeout(() => {
      owned.add(id);
      if (p.id === 'remove_ads' && window.NeonAds) window.NeonAds.removeAds();
      if (cb) cb(true, p);
    }, 300 + Math.random() * 400);
  }

  function owns(id) { return owned.has(id); }
  function restore(cb) { setTimeout(() => { if (cb) cb(true); }, 200); }

  return { products, getProducts, purchase, owns, restore };
})();
