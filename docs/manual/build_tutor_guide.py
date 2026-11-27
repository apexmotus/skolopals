"""Builds the Skolopals Tutor guide: from opening applications to confirming an online register.

Screenshots: apps/client/scripts/manual/10-13-tg-*.mjs, captured from UAT into images/
(ta = administrator, tp = applicant, tt = tutor, tg = guardian).
Run: python3 docs/manual/build_tutor_guide.py
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
from manual_kit import Manual  # noqa: E402

m = Manual(
    brand={
        "product": "Skolopals",
        "org": "Skolopals Tutoring Centre",
        "address": "10 Plumbago Street, Damonsville, Brits",
        "version": "Version 1.0, November 2026",
        "cover_title": "Tutor guide",
        "doc_title": "Skolopals Tutor Guide",
        "cover_subtitle": "From applying to your first register",
        "cover_blurb": "For people who want to teach at Skolopals, and for the centre staff who recruit them.",
        "logo": str((ROOT / "../../apps/client/public/images/logo.png").resolve()),
    },
    images=ROOT / "images",
)

# Show whole phone screens (about 125 mm tall at this width): the last callout is often the button
# at the bottom, which the kit's default 108 mm cap cuts off.
_phone_fig = m.fig


def _whole_phone_fig(name, caption, callouts=None, max_mm=None):
    if max_mm is None and name.startswith(("tp", "tg")):
        max_mm = 126
    _phone_fig(name, caption, callouts, max_mm)


m.fig = _whole_phone_fig

if os.environ.get("DRAFT"):
    # Draft builds show a placeholder for screenshots not taken yet.
    _fig = m.fig

    def _draft_fig(name, *args, **kwargs):
        if not (ROOT / "images" / f"{name}.png").exists():
            m.note(f"Screenshot <b>{name}</b> not captured yet.", "important")
            return
        _fig(name, *args, **kwargs)

    m.fig = _draft_fig

# ---------------------------------------------------------------------------------------------
# Introduction
# ---------------------------------------------------------------------------------------------

m.h2("Welcome")
m.p("This guide shows how someone becomes a Skolopals tutor and teaches their first online lesson: from the day "
    "the centre opens applications to the moment the tutor confirms who attended.")
m.p("It follows one person. <b>Palesa Mokoena</b> sees that the centre is looking for Mathematics tutors, applies "
    "on her phone, is approved by the centre administrator <b>Lindiwe</b>, and teaches an online Maths class. "
    "<b>Amahle Mthembu</b> (Grade 6) joins the class, with her mother <b>Thuli</b>. All names, numbers and "
    "documents in this guide are examples from a test copy of the system.")

m.h2("Who does what")
m.table(
    ["You are…", "You use", "Read"],
    [
        ["Someone applying to teach", "The website, on your phone or a computer", "Part 2"],
        ["A tutor", "The <b>Tutor workspace</b>", "Part 4"],
        ["Centre staff (administrator)", "The <b>Admin workspace</b>, on a computer", "Parts 1, 3 and 4"],
    ],
)

m.h2("How to read the pictures")
m.p("Each screenshot has yellow numbered markers. The list next to the picture explains each number. Applicant "
    "screens are shown as they look on a phone; tutor and administrator screens as they look on a computer.")

m.h2("The journey at a glance")
m.journey(
    [
        ("1. Open", "The centre opens tutor applications; Apply to teach appears on the website", "a"),
        ("2. Apply", "The applicant creates an account and fills in 7 short steps", "p"),
        ("3. Review", "The centre checks the ID against the selfie, the documents and the references", "a"),
        ("4. Approve", "The applicant's account becomes a tutor account; the centre sets pay and activates it", "a"),
        ("5. Teach", "The centre gives the tutor a class; learners join online lessons through Skolopals", "t"),
        ("6. Register", "After the lesson the tutor checks who joined and confirms the register", "t"),
    ],
    {"a": "Administrator", "p": "Applicant", "t": "Tutor"},
)

# ---------------------------------------------------------------------------------------------
# Part 1: Opening applications
# ---------------------------------------------------------------------------------------------

m.part("Part 1", "Opening applications", "Lindiwe starts recruiting",
       "The centre decides when it is recruiting. While applications are open, an <b>Apply to teach</b> button "
       "appears on the website. Close them again at any time.")

m.h2("1.1 Open applications")
m.fig("ta01-closed", "Admin workspace → <b>Tutor applications</b>, while applications are closed.", [
    "The current state: closed. Once there have been rounds, this also shows the last one's dates and number of applications.",
    "<b>Open applications</b> opens the form below.",
])
m.fig("ta02-open-dialog", "Choose how this round works, then open it.", [
    "<b>Closing date</b> (optional). Applications close at the end of that day. Leave it empty to close them yourself.",
    "<b>Message for applicants</b> (optional): shown on the website and at the top of the form.",
    "<b>Subjects you need</b> (optional). They're shown on the website and marked <b>Needed</b> on the form, "
    "and applications that offer them are flagged for you.",
    "<b>Require a police clearance certificate</b>. Off by default: a SAPS certificate takes weeks to get, so "
    "asking for it up front puts many people off. You can still ask any one applicant for it later (section 3.3).",
    "<b>Open applications</b>. The button appears on the website within a minute.",
])
m.fig("ta03-open", "Applications are open.", [
    "When the round opened, when it closes and how many people have applied so far.",
    "Your message and the subjects you need, as applicants see them.",
    "<b>Edit</b> changes the closing date, message, subjects or police clearance. Changes apply to "
    "applications sent from then on.",
    "<b>Close now</b> takes the button off the website straight away. Applications already sent stay here.",
])
m.note("Each time you open applications is a <b>round</b>. A person can apply once per round. Closing "
       "applications never deletes what has been sent.", "staff")

# ---------------------------------------------------------------------------------------------
# Part 2: Applying
# ---------------------------------------------------------------------------------------------

m.part("Part 2", "Applying to teach", "Palesa applies on her phone",
       "What an applicant does: find the application, create an account, fill in seven short steps and follow "
       "what happens next. It takes about 15 minutes.")

m.h2("2.1 Find the application")
m.pair("tp01-home", "The home page while applications are open: <b>Apply to teach</b> sits under the "
       "family buttons.",
       "tp02-home-banner", "Further down, <b>We're looking for tutors</b> shows the centre's message, the "
       "subjects it needs most and the closing date.")
m.fig("tp03-teach-signed-out", "The <b>Apply to teach</b> page, before you sign in.", [
    "The subjects the centre needs most.",
    "What to have ready: your CV and at least one qualification (a photo of the certificate is fine), your ID, "
    "a phone camera for a selfie, and three references who have agreed to be contacted.",
    "<b>Create an account</b> if you're new to Skolopals.",
    "<b>I already have one</b> if you have a Skolopals account, for example as a parent.",
])

m.h2("2.2 Create your account")
m.fig("tp04-signup", "Sign up. Use an email address you can open: we send you a link to confirm it.", [
    "Your email address. The centre uses it to contact you about your application.",
    "A password of at least 8 characters, typed twice.",
    "<b>Create account</b>.",
])
m.fig("tp05-check-email", "Check your email.", [
    "Open the email from Skolopals and tap the link. It confirms your account and brings you straight back to "
    "the application. Can't find it? Look in your spam or promotions folder.",
])

m.h2("2.3 Fill in the application")
m.p("The application has seven steps. <b>Next</b> checks each step before moving on, and <b>Back</b> keeps what "
    "you've typed. Have your documents on your phone before you start.")
m.fig("tp06-about", "Step 1, About you.", [
    "Where you are: seven steps in all.",
    "Your email comes from your account and can't be changed here.",
    "Your mobile number.",
    "Leave <b>My WhatsApp number is the same</b> on, or switch it off to give a different WhatsApp number.",
    "<b>Next</b>.",
])
m.fig("tp07-address", "Step 2, Your address.", [
    "Street address. Line 2 (unit, complex or suburb) is optional.",
    "Province.",
    "Country: South Africa unless you change it.",
])
m.fig("tp08-subjects", "Step 3, What you can teach.", [
    "Choose a subject. Those the centre needs most say <b>(Needed)</b>.",
    "Tick every grade you can teach it at. Only grades the centre offers for that subject are listed.",
    "Tick the languages you can teach it in.",
    "<b>Add another subject</b> for each further subject.",
])
m.fig("tp09-documents", "Step 4, CV and qualifications. PDF, JPG, PNG or an iPhone photo, up to 10 MB each.", [
    "Your CV.",
    "A qualification: a degree, diploma or certificate. A clear photo of the certificate is fine.",
    "Its title is required; the institution and year are optional.",
    "<b>Add another qualification</b>, up to three.",
])
m.fig("tp10-identity", "Step 5, Confirm who you are.", [
    "A photo of your ID: the front of your smart ID card, or the photo page of your green ID book or passport. "
    "Make sure every corner is in the picture.",
    "The back of a smart ID card, if you have one (optional).",
    "A selfie: face the camera in good light, with no hat or sunglasses. On a phone this opens the front camera.",
])
m.note("Only the centre's administrators see your ID and selfie. They are never shown on your public profile.",
       "privacy")
m.fig("tp11-references", "Step 6, Three references.", [
    "Their full name.",
    "How they know you, for example <i>Head of Department at my previous school</i>.",
    "Their phone number. An email address is optional.",
])
m.fig("tp12a-review", "Step 7, Check and send.", [
    "Each section has <b>Edit</b>, which takes you back to that step.",
])
m.fig("tp12b-consent", "Agree and send.", [
    "That Skolopals may use your information, including your ID and photo, to assess your application.",
    "That your references have agreed to be contacted.",
    "That what you've given is true.",
    "<b>Send application</b>.",
])

m.h2("2.4 After you've applied")
m.fig("tp13-received", "Come back to <b>Apply to teach</b> at any time to see where your application is.", [
    "Your application and the date you sent it.",
    "Its status (see the table below).",
    "<b>Withdraw my application</b>, while the centre hasn't looked at it yet. You can apply again the next "
    "time the centre opens applications.",
])
m.table(
    ["Status", "What it means"],
    [
        ["<b>Received</b>", "The centre has your application and will be in touch."],
        ["<b>Shortlisted</b>", "The centre will contact you to arrange an interview."],
        ["<b>Approved</b>", "Your account is now a tutor account. Sign out and sign in again to open the tutor workspace."],
        ["<b>Not successful</b>", "The centre won't be taking your application further this time."],
        ["<b>Withdrawn</b>", "You withdrew it."],
    ],
)
m.p("You also get a notification (the bell at the top of the page) each time your status changes.")

# ---------------------------------------------------------------------------------------------
# Part 3: Reviewing
# ---------------------------------------------------------------------------------------------

m.part("Part 3", "Reviewing and approving", "Lindiwe reviews Palesa's application",
       "How the centre checks an application, asks for a police clearance certificate when it needs one, and "
       "turns a successful applicant into a tutor.")

m.h2("3.1 The applications list")
m.fig("ta04-list", "Admin workspace → <b>Tutor applications</b>. Every administrator is notified of each new application.", [
    "The number on the menu is how many applications are waiting for you.",
    "Open an application by its name.",
    "<b>Needed</b>: the applicant offers a subject you asked for.",
])
m.p("The tabs above the list show <b>Needs action</b> (new and shortlisted), <b>Approved</b>, <b>Rejected</b> "
    "and <b>Withdrawn</b>.")

m.h2("3.2 Check the application")
m.fig("ta05-detail", "The top of an application: the decision buttons.", [
    "<b>Decision</b>.",
    "<b>Shortlist</b> tells the applicant you'll contact them to arrange an interview.",
    "<b>Reject</b> tells them, with a standard message, that you won't take it further. Your note stays internal.",
    "<b>Approve</b>: see section 3.4.",
])
m.fig("ta06-identity", "Confirm who they are.", [
    "The <b>Identity</b> card.",
    "Their ID photo. Check that the name matches the application.",
    "Their selfie. Check that it is the same face as on the ID.",
    "<b>Mark identity checked</b> when they match. The ID and selfie are marked as verified on their tutor record.",
])
m.fig("ta07-teach-docs-refs", "Further down: what they can teach, their documents and references.", [
    "Subjects, grades and languages.",
    "<b>Open</b> shows the CV or certificate. Links work for 5 minutes; reload the page for fresh ones.",
    "Their three references. Phone them before you approve, and record the checks on the tutor record afterwards.",
])

m.h2("3.3 Ask for a police clearance certificate")
m.p("If the round doesn't require one, you can still ask a particular applicant (or, later, a tutor) for a "
    "police clearance certificate.")
m.fig("ta08-request-clearance", "<b>Request police clearance</b>, on the application.", [
    "An optional message, for example a date to send it by.",
    "<b>Send request</b>. The applicant gets a notification and an upload card on their application page.",
])
m.fig("ta09-clearance-requested", "Waiting for it.", [
    "Requested, and the date.",
    "Your message. <b>Ask again</b> sends a reminder.",
])
m.fig("tp14-clearance-requested", "What the applicant sees on <b>Apply to teach</b>.", [
    "Their application's status.",
    "The request, with your message.",
    "Tap to upload a PDF or a clear photo of the SAPS certificate.",
])
m.fig("tp15-clearance-ready", "Once it has uploaded.", [
    "The file.",
    "<b>Send certificate</b>. Administrators are notified, and the application shows it as received.",
])

m.h2("3.4 Approve")
m.fig("ta11-approve-dialog", "<b>Approve</b> asks you to confirm.", [
    "They start <b>suspended</b>: not in the public tutor directory and not assignable to classes until you "
    "activate them. If you haven't marked the identity checked, or a police clearance you asked for hasn't "
    "arrived, it warns you here.",
    "<b>Approve</b>.",
])
m.fig("ta12-tutor-approved", "Approving takes you to their new tutor page.", [
    "What happened: their subjects, documents and references have been copied across.",
    "Their status, still <b>suspended</b>.",
    "What they teach, from the application.",
])
m.p("The applicant is told by notification. Their account is now a tutor account; if they were signed in, they "
    "sign out and in again to see the tutor workspace.")

m.h2("3.5 Set their pay and activate them")
m.fig("ta13-pay", "<b>Pay</b>, on the tutor page.", [
    "How they are paid: per hour, per session or a monthly salary.",
    "The amount in Rand, from the date you choose.",
    "<b>Set rate</b>.",
])
m.fig("ta14-activate", "When vetting is done, activate them.", [
    "Choose <b>Active</b>.",
    "<b>Update</b>.",
])
m.fig("ta15-tutor-active", "Ready to teach.", [
    "<b>Active</b>: they appear in the tutor directory and can be given classes.",
])

# ---------------------------------------------------------------------------------------------
# Part 4: Teaching
# ---------------------------------------------------------------------------------------------

m.part("Part 4", "Teaching an online class", "Palesa teaches her first lesson",
       "The tutor's first look at the tutor workspace, how the centre gives them a class, how learners join an "
       "online lesson, and how the tutor confirms the register afterwards.")

m.h2("4.1 Give the tutor a class")
m.p("A tutor can only be given a class whose subject, grades and language they are recorded as teaching.")
m.fig("ta16-add-online-class", "Admin workspace → <b>Timetable</b> → <b>Add a class</b>.", [
    "The class name families will see.",
    "The tutor. Only tutors who teach this subject, at every grade ticked and in this language, can be chosen.",
    "<b>Online</b> (or hybrid) delivery: no room is needed.",
    "The meeting link (Google Meet, Zoom, Teams…). Families never see it directly: they join through Skolopals, "
    "which records who joined.",
    "<b>Create class and generate sessions</b> creates the class's sessions for the term.",
])
m.fig("ta17-place-learner", "Place learners in the class.", [
    "The class.",
    "Choose a learner.",
    "<b>Add learner</b>. Their family is notified and the class appears on their timetable.",
])

m.h2("4.2 The tutor workspace")
m.fig("tt01-overview", "Palesa's <b>Overview</b> when she signs in.", [
    "<b>Overview</b>: her classes, learners and the next seven days. <b>Start on Google Meet</b> opens the lesson.",
    "<b>My schedule</b>: every session over the next month, with the link for each online one.",
    "<b>Attendance register</b>: see section 4.4.",
])
m.fig("tt02-schedule", "<b>My schedule</b>.")

m.h2("4.3 How learners join")
m.fig("tg01-family-join", "On the family's <b>Timetable</b> (here Thuli's phone), each online session has its own link.", [
    "The class and when it starts.",
    "<b>Join on Google Meet</b>. It works from 15 minutes before the start until the lesson ends. Learners with "
    "their own login have the same link on their timetable.",
])
m.fig("tg02-join-page", "The join page.", [
    "<b>Ready to join?</b> Before the window opens it says <b>Not open yet</b>; after the lesson, <b>This class has ended</b>.",
    "<b>Join as Amahle</b> records who joined and when, then opens the meeting. A parent with two children in the "
    "class chooses which child is joining.",
])

m.h2("4.4 After the lesson: confirm the register")
m.fig("tt03-register-online", "<b>Attendance register</b>, after an online lesson.", [
    "<b>Choose a session</b> and tap <b>Open</b>. The register opens on the lesson that started most recently.",
    "Who opened the join link, and when (<b>Joined 10:48</b>). Anyone who didn't shows <b>Didn't open the link</b>.",
    "The suggested mark: <b>Present</b> if they joined by 10 minutes after the start, <b>Late</b> after that, "
    "<b>Absent</b> if they didn't join. Nothing is saved yet. Change any line to match who was really in the "
    "call, for example a learner who joined but left straight away.",
    "<b>Confirm register</b> saves every mark at once.",
])
m.note("Joining only proves the learner opened the link, not that they stayed. That's why the register "
       "waits for you to confirm it.", "important")
m.fig("tt04-register-confirmed", "Saved.", [
    "<b>Register saved. Parents see it now.</b> To correct a mark later, change the line and confirm again.",
])
m.fig("tg03-attendance", "What Thuli sees on her <b>Attendance</b> page.", [
    "The class and date.",
    "The mark Palesa confirmed.",
])
# ---------------------------------------------------------------------------------------------
# Extras
# ---------------------------------------------------------------------------------------------

m.part("Extras", "Questions and privacy", "For everyone", "Common questions, and how Skolopals looks after "
       "applicants' information.")

m.h2("Frequently asked questions")
m.faq([
    ("I can't see Apply to teach on the website.",
     "The centre isn't recruiting at the moment. Check again later, or get in touch through the Contact page."),
    ("I already have a Skolopals account as a parent. Can I apply?",
     "Yes. Choose <b>I already have one</b> and sign in. If you're approved, your account keeps your children."),
    ("I never got the confirmation email.",
     "Check your spam or promotions folder. If it still hasn't arrived, or the link has expired, contact the "
     "centre and they will help you confirm your account."),
    ("Can I change my application after sending it?",
     "No. Contact the centre with the change. Withdrawing doesn't help: you can apply only once each time the "
     "centre opens applications."),
    ("My upload says it didn't finish.",
     "Check your connection and try again. Files must be a PDF, JPG, PNG or iPhone photo, up to 10 MB. The selfie "
     "and the back of an ID card must be photos."),
    ("I was approved but I still see the application page.",
     "Sign out and sign in again. Your account changes to a tutor account when you next sign in."),
    ("A learner joined but isn't marked present.",
     "The mark is only a suggestion until you confirm it. Change it on the register before you tap "
     "<b>Confirm register</b>."),
])

m.h2("Your information (POPIA)")
m.bullets(
    "Skolopals uses an applicant's details, ID, selfie and documents only to assess the application and confirm "
    "who they are.",
    "Only the centre's administrators can see them. The ID and selfie are never shown publicly.",
    "References are contacted only with the applicant's agreement, given when they apply.",
    "If an application is not successful or is withdrawn, it is deleted, with every document, 12 months after "
    "the decision. An administrator confirms each deletion, and it is logged.",
    "If the applicant becomes a tutor, the documents are kept with their staff record.",
)

m.build(ROOT / "Skolopals-Tutor-Guide.pdf")
