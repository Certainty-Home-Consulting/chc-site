const CHC_FORM_ENDPOINT = window.CHC_FORM_ENDPOINT || 'https://script.google.com/macros/s/AKfycby8jXhb18s0NOmR65n10f3IpnbOjiff-81LqwKyrtOLFRZP5cvvoIERRRTPDEzqHVqiVQ/exec';

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    const setStatus = (msg) => {
        const el = document.getElementById('form-status');
        if (el) el.textContent = msg || '';
    };

    // Contact form handling
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = this.querySelector('button[type="submit"]');

            // Get form data
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);

            // Basic validation
            if (!data.name || !data.email || !data.project) {
                setStatus('Please fill in all required fields.');
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                setStatus('Please enter a valid email address.');
                return;
            }

            // Honeypot
            if (data.website) {
                setStatus('Submitted.');
                this.reset();
                return;
            }

            if (!CHC_FORM_ENDPOINT) {
                setStatus('Intake endpoint not configured yet.');
                return;
            }

            try {
                btn.disabled = true;
                setStatus('Submitting...');

                // Apps Script web apps typically do not return CORS headers.
                // Use no-cors + form-encoded payload for reliable cross-origin submit.
                const formBody = new URLSearchParams(data);
                await fetch(CHC_FORM_ENDPOINT, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                    body: formBody
                });

                setStatus('Thanks — your advisory request is in. Todd will follow up shortly.');
                this.reset();
            } catch (err) {
                setStatus('Submission failed. Please try again in a minute.');
                console.error(err);
            } finally {
                btn.disabled = false;
            }
        });
    }

    // Header scroll effect
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (window.scrollY > 100) {
            header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        } else {
            header.style.boxShadow = 'none';
        }
    });
});

// Project budget validation
function validateBudget(projectText) {
    const budgetRegex = /\$?\d{1,3}(,\d{3})*(\.\d{2})?[kK]?/;
    return budgetRegex.test(projectText);
}

// Smooth animations on scroll (optional enhancement)
function observeElements() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all major sections
    document.querySelectorAll('section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
}