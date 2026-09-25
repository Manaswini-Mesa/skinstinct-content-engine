// Posts to Meera's personal LinkedIn profile.
async function personUrn(token) {
  if (process.env.LINKEDIN_PERSON_URN) return process.env.LINKEDIN_PERSON_URN;
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.sub) throw new Error('Could not read LinkedIn profile. Token may be missing the "openid profile" scopes or has expired.');
  return `urn:li:person:${data.sub}`;
}

export function linkedinConfigured() {
  return Boolean(process.env.LINKEDIN_ACCESS_TOKEN);
}

export async function postToLinkedIn(text) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const author = await personUrn(token);
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const id = res.headers.get('x-restli-id');
  return id ? `https://www.linkedin.com/feed/update/${id}` : 'https://www.linkedin.com/feed/';
}
