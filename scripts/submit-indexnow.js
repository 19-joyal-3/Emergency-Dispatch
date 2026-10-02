// Automated IndexNow Submission Script
// Notifies Bing, DuckDuckGo, Yahoo, Yandex and Seznam to index Resylix immediately

async function submitToIndexNow() {
  const host = "emergency-dispatch-2.onrender.com";
  const key = "c8397a67b5e84869b2d880470d0fb925";
  const keyLocation = `https://${host}/${key}.txt`;
  const urlList = [
    `https://${host}/`,
    `https://${host}/RESYLIX_PRESENTATION_DECK.html`,
    `https://${host}/RESYLIX_MASTER_CAPABILITIES_AND_FUTURE_SCOPE.html`,
    `https://${host}/privacy-policy.html`
  ];

  const payload = {
    host,
    key,
    keyLocation,
    urlList
  };

  console.log('Sending IndexNow payload to api.indexnow.org...');
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    console.log(`IndexNow Response Status: ${response.status} ${response.statusText}`);
    if (response.status === 200 || response.status === 202) {
      console.log('✓ Successfully submitted to IndexNow! Search engines notified for instant indexing.');
    } else {
      const text = await response.text();
      console.log('IndexNow Response Body:', text);
    }
  } catch (err) {
    console.error('IndexNow submission error:', err.message);
  }
}

submitToIndexNow();
