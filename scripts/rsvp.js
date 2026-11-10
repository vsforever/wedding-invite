'use strict';

const rsvpForm = $('#rsvpForm');
const rsvpWishes = $('#rsvpWishes');
const rsvpError = $('#rsvpError');
const RSVP_SENT_KEY = 'wedding-invitation-wishes-sent';
let rsvpPending = false;

function showRsvpStep(step) {
  rsvp.querySelectorAll('[data-rsvp-step]').forEach((node) => { node.hidden = node.dataset.rsvpStep !== step; });
}

// Each message is saved separately, rather than replacing an earlier blessing.
function markRsvpSent() {
  $('#rsvpStatus').textContent = 'You’ve shared a little love from this device. You’re welcome to leave another message.';
}
try { if (localStorage.getItem(RSVP_SENT_KEY)) markRsvpSent(); } catch (_) { /* storage blocked */ }

rsvpForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (rsvpPending) return;
  const wishes = rsvpWishes.value.trim();
  rsvpError.textContent = '';
  if (!wishes || wishes.length > 2000) {
    rsvpError.textContent = wishes ? 'Please keep your lovely message within 2,000 characters.' : 'Please write a wish, a blessing, or a little advice before sending.';
    rsvpWishes.focus();
    return;
  }
  if (!RSVP_ENDPOINT) {
    rsvpError.textContent = 'Online wishes aren’t connected yet. Please share your blessings with us directly.';
    return;
  }

  const submit = $('#rsvpSubmit');
  rsvpPending = true;
  submit.disabled = true;
  submit.textContent = 'Sending your blessings…';
  rsvpForm.setAttribute('aria-busy', 'true');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const body = new URLSearchParams({ wishes, website: rsvpForm.elements.website.value });
    const response = await fetch(RSVP_ENDPOINT, { method: 'POST', body, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'rejected');
    try { localStorage.setItem(RSVP_SENT_KEY, '1'); } catch (_) { /* storage blocked */ }
    markRsvpSent();
    $('#rsvpThanks').textContent = 'Your wishes and blessings have been received. We’ll treasure your words as we begin our forever. 💛';
    showRsvpStep('thanks');
    miniConfetti({ y: 0.5 });
    $('#rsvpThanksTitle').focus();
  } catch (error) {
    console.error('Wishes submission failed', error);
    rsvpError.textContent = 'Your message couldn’t reach us just yet. Please check your connection and try again.';
  } finally {
    clearTimeout(timeout);
    rsvpPending = false;
    submit.disabled = false;
    submit.textContent = 'Send your blessings 💗';
    rsvpForm.removeAttribute('aria-busy');
  }
});
$('#rsvpAnother').addEventListener('click', () => {
  rsvpForm.reset();
  rsvpError.textContent = '';
  showRsvpStep('form');
  rsvpWishes.focus();
});
