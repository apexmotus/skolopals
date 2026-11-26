from __future__ import annotations
"""Builds the Skolopals user manual: manual.html -> Skolopals-User-Manual.pdf (WeasyPrint CLI).

Screenshots come from apps/client/scripts/manual/*.mjs (captured from UAT) into images/.
Run: python3 docs/manual/build.py
"""
from html import escape
from pathlib import Path

from PIL import Image
import subprocess

ROOT = Path(__file__).parent
IMG = ROOT / "images"
LOGO = (ROOT / "../../apps/client/public/images/logo.png").resolve()

out: list[str] = []
toc: list[tuple[int, str, str]] = []
_ids = 0


def anchor(level: int, title: str) -> str:
    global _ids
    _ids += 1
    aid = f"s{_ids}"
    toc.append((level, title, aid))
    return aid


def part(num: str, title: str, who: str, intro: str):
    aid = anchor(1, f"{num} · {title}")
    out.append(
        f'<section class="part" id="{aid}"><div class="part-num">{escape(num)}</div>'
        f"<h1>{escape(title)}</h1><p class=\"who\">{escape(who)}</p><p class=\"lead\">{intro}</p></section>"
    )


def h2(title: str):
    out.append(f'<h2 id="{anchor(2, title)}">{escape(title)}</h2>')


def h3(title: str):
    out.append(f"<h3>{escape(title)}</h3>")


def p(html: str):
    out.append(f"<p>{html}</p>")


def steps(*items: str):
    out.append("<ol class=\"steps\">" + "".join(f"<li>{i}</li>" for i in items) + "</ol>")


def bullets(*items: str):
    out.append("<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>")


def note(html: str, kind: str = "tip"):
    label = {"tip": "Tip", "important": "Important", "staff": "For staff", "privacy": "Your privacy"}[kind]
    out.append(f'<div class="note {kind}"><strong>{label}</strong> {html}</div>')


WEB = IMG / "_pdf"
WEB.mkdir(exist_ok=True)


def src(name: str) -> str:
    """A JPEG copy at print size, so the PDF stays small."""
    path = IMG / f"{name}.png"
    if not path.exists():
        raise SystemExit(f"missing image {path}")
    dest = WEB / f"{name}.jpg"
    if not dest.exists() or dest.stat().st_mtime < path.stat().st_mtime:
        im = Image.open(path).convert("RGB")
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        im.save(dest, "JPEG", quality=82, optimize=True)
    return dest.as_uri()


def fig(name: str, caption: str, callouts: list[str] | None = None, crop: float | None = None):
    """One screenshot with its numbered callouts explained. Phone shots sit beside the text."""
    w, h = Image.open(IMG / f"{name}.png").size
    phone = w <= 800
    uri = src(name)
    legend = ""
    if callouts:
        legend = '<ol class="callouts">' + "".join(
            f'<li><span class="badge">{i}</span><span>{c}</span></li>' for i, c in enumerate(callouts, 1)
        ) + "</ol>"
    style = f' style="max-height:{crop}mm"' if crop else ""
    if phone:
        out.append(
            f'<figure class="phone"><div class="shot"><img src="{uri}"{style}></div>'
            f'<figcaption><p class="cap">{caption}</p>{legend}</figcaption></figure>'
        )
    else:
        out.append(
            f'<figure class="desk"><img src="{uri}"{style}>'
            f'<figcaption><p class="cap">{caption}</p>{legend}</figcaption></figure>'
        )


def pair(a: str, cap_a: str, b: str, cap_b: str):
    """Two phone screens side by side, for a before/after."""
    out.append(
        '<div class="pair">'
        + "".join(
            f'<figure><img src="{src(n)}"><figcaption>{c}</figcaption></figure>'
            for n, c in ((a, cap_a), (b, cap_b))
        )
        + "</div>"
    )


def table(head: list[str], rows: list[list[str]]):
    out.append(
        "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in head) + "</tr></thead><tbody>"
        + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
        + "</tbody></table>"
    )


def pagebreak():
    out.append('<div class="break"></div>')


# ---------------------------------------------------------------------------------------------
# Introduction
# ---------------------------------------------------------------------------------------------

h2("Welcome")
p("Skolopals is an after-school tutoring centre in Damonsville, Brits. This manual shows you how to use the "
  "Skolopals website and portals, from the day a family applies to the day a learner is signed out at the door.")
p("It follows one family through the whole journey. <b>Thuli Mthembu</b> enrols her daughter <b>Amahle</b> "
  "(Grade 6) for Mathematics and Afrikaans. You will see what Thuli does, what Amahle does, what the tutor "
  "<b>Johan</b> does and what the centre administrator <b>Lindiwe</b> does. All names, numbers and documents "
  "in this manual are examples from a test copy of the system.")

h2("Who does what")
table(
    ["You are…", "You use", "Read"],
    [
        ["A parent or guardian", "The website and the <b>Parent portal</b>, usually on your phone", "Part 1"],
        ["A learner", "The aptitude test, and the <b>Learner portal</b> if the centre gives you a login", "Part 2"],
        ["A tutor", "The <b>Tutor workspace</b>, on a computer or your phone at the door", "Part 3"],
        ["Centre staff (administrator)", "The <b>Admin workspace</b>, on a computer", "Part 4"],
    ],
)

h2("How to read the pictures")
p("Each screenshot has yellow numbered markers. The list next to the picture explains each number, in the "
  "order you would use them. Parent and learner screens are shown as they look on a phone; tutor and "
  "administrator screens as they look on a computer. On a computer, the parent portal has the same pages "
  "with the menu down the left-hand side instead of behind the <b>☰</b> button.")

h2("The journey at a glance")
out.append("""
<div class="journey">
  <div class="j g"><b>1. Apply</b><span>Parent creates an account and fills in the 6-step application</span></div>
  <div class="j l"><b>2. Test</b><span>Learner does a 20-minute aptitude test</span></div>
  <div class="j a"><b>3. Review</b><span>Centre reads the report card and test, then accepts</span></div>
  <div class="j g"><b>4. Pay</b><span>Parent pays with PayShap and uploads proof within 7 days</span></div>
  <div class="j a"><b>5. Place</b><span>Centre confirms payment; the learner is placed in classes</span></div>
  <div class="j t"><b>6. Attend</b><span>Signed in at the door, or joins online; tutor keeps the register</span></div>
  <div class="j g"><b>7. Follow</b><span>Parent sees attendance, reports and invoices every month</span></div>
</div>
<p class="legend"><span class="dot g"></span>Parent <span class="dot l"></span>Learner <span class="dot t"></span>Tutor <span class="dot a"></span>Administrator</p>
""")

# ---------------------------------------------------------------------------------------------
# Part 1: Guardian
# ---------------------------------------------------------------------------------------------

part("Part 1", "Parents and guardians", "Thuli enrols Amahle",
     "Everything a parent or guardian does: applying, paying, keeping your child's details up to date and "
     "following their attendance, reports and fees.")

h2("1.1 The website")
fig("g01-home", "The Skolopals home page on a phone.", [
    "The menu: Subjects, Our Tutors, Timetable, Holiday Programmes, Fees, Contact and Login.",
    "<b>Enrol a learner</b> starts an application. You will be asked to create an account first.",
])
p("The <b>Fees</b> page lists every package and what it costs; the <b>Timetable</b> page shows the centre's "
  "opening hours and classes. You don't need an account to look at these.")

h2("1.2 Create your account and sign in")
fig("g03-signup", "Sign up. You need an email address you can open, because we send a confirmation link.", [
    "Fill in your name, email, mobile number and a password of at least 8 characters, then tap "
    "<b>Create account</b>. Open the email from Skolopals and tap the link to confirm your account.",
])
fig("g04-login", "Signing in.", [
    "Your email address.",
    "Your password.",
    "<b>Forgot password?</b> sends you a link to choose a new one.",
])
fig("g05-forgot-password", "Forgot your password? Enter your email and we send a reset link. "
    "The link works once and expires; if it has expired, ask for a new one.", [
    "Enter the email you signed up with and tap the button. Check your spam folder if nothing arrives.",
])

h2("1.3 Apply for your child")
p("From your portal, tap <b>Start enrolment</b> (or <b>Enrol another child</b> under My learners). The "
  "application has six steps. Nothing is charged now: you only pay once the centre accepts the application.")
fig("g07-enrol-package", "Step 1: choose a package.", [
    "Where you are in the six steps.",
    "Choose the package. Group packages cover a set number of subjects; the others cover all subjects.",
    "<b>Next</b> takes you to the following step. You can go <b>Back</b> at any time; nothing is lost.",
])
fig("g08-enrol-child", "Step 2: about your child.", [
    "Your child's first and last name.",
    "Date of birth.",
    "The grade they are in this year.",
])
fig("g09-enrol-report", "Step 3: the school report card.", [
    "Upload a photo or PDF of your child's most recent school report. On a phone you can take a photo of it.",
    "The year it covers.",
    "The term it covers.",
])
note("No school report yet (for example, a Grade R or Grade 1 learner)? Contact the centre before you apply.")
fig("g10-enrol-subjects", "Step 4: subjects.", [
    "Tick each subject your child needs help with. If you tick more than your package covers, we move you "
    "to a package that covers them and tell you.",
    "Choose the language each subject is taught in. Mathematics in English and Afrikaans as a subject is a "
    "normal combination.",
])
fig("g11-enrol-tutor", "Step 5: a preferred tutor (optional).", [
    "Leave this on <b>No preference</b> unless you have a tutor in mind. Placement depends on the timetable.",
])
fig("g12a-enrol-emergency", "Step 6: keeping your child safe. First, who we call in an emergency.", [
    "Tick if you are the emergency contact. We then ask for a second person.",
    "Your second emergency contact: name, relationship and phone number.",
])
fig("g12b-enrol-collect", "Who may collect your child from the centre.", [
    "Tick if you collect your child yourself. Parents and guardians linked to the child may always collect.",
    "Anyone else who may collect: an aunt, grandparent or driver.",
    "The <b>last 4 digits of their ID number</b>. Staff check this against the person's ID at the door, so "
    "it is required.",
])
fig("g13a-enrol-consent", "Your permission. The law (POPIA) requires a parent's consent before we may "
    "process a child's information.", [
    "<b>Required:</b> processing your child's personal information.",
    "<b>Required:</b> storing information outside South Africa (our systems are hosted in the United Kingdom).",
    "<b>Optional:</b> photographs and schoolwork in marketing, and WhatsApp and email updates. Saying no does "
    "not affect your child's place.",
])
fig("g13b-enrol-check", "Check and send.", [
    "A summary of the application. Use <b>Back</b> to change anything.",
    "What your first payment would be if the centre accepts today: the R150 registration fee plus the rest "
    "of this month's tuition.",
    "<b>Send application</b>. Your child's aptitude test opens straight after.",
])

h2("1.4 The aptitude test")
p("Straight after you send the application, your child does a short activity of reading questions and "
  "puzzles. It helps the tutor know where to start; it is not a pass or fail test. Hand the phone or "
  "computer to your child for this part (see <b>Part 2</b> for what they see).")
fig("g14-test-intro", "The start of the test.", [
    "Reassurance for your child: it's not a pass or fail test.",
    "<b>Start</b> begins the 25 questions. It takes about 20 minutes.",
])
bullets(
    "Younger children may need you to read the questions aloud. Please don't help with the answers.",
    "Your child can stop and come back later; the answers so far are saved.",
    "If you don't do the test now, your portal shows <b>Go to the test</b> until it is done.",
)
fig("g15-overview-tracker", "Your portal keeps track of the application.", [
    "<b>Go to the test</b> opens the test where your child left off.",
])
pair("g17-test-done", "When the test is finished, your child hands the device back to you.",
     "g18-application-sent", "The application is now with the centre for review.")

h2("1.5 Waiting for the centre")
p("The centre reads the report card and the test result, then does one of these:")
table(["What happens", "What you see"], [
    ["<b>Accepted</b>", "A notification, and the <b>Pay with PayShap</b> button on your Overview. You have "
     "<b>7 days</b> to pay, or the offer lapses."],
    ["<b>More information needed</b>", "A message explaining what is needed, for example a clearer report "
     "card. Use <b>Replace report card</b> on your Overview."],
    ["<b>Test again</b>", "The centre can let your child take the test again."],
    ["<b>Declined</b>", "A message with the reason."],
])

h2("1.6 Pay with PayShap")
fig("g20-overview-pay", "Accepted! Your Overview shows the next step.", [
    "The good news, with the amount and the date to pay by.",
    "<b>Pay with PayShap</b> opens the four payment steps.",
])
fig("g21-pay-review", "Payment step 1: check what you are paying for.", [
    "The total to pay: the registration fee plus the rest of this month.",
    "<b>Continue to payment</b>.",
])
fig("g22-pay-payshap", "Payment step 2: pay from your banking app.", [
    "The centre's <b>ShapID</b>. Tap <b>Copy</b> and paste it in your banking app under Pay → PayShap.",
    "The exact amount.",
    "The <b>reference</b>: always use the invoice number so we can match your payment.",
    "Once you have paid, tap <b>I have made the payment</b>.",
])
note("Skolopals never asks for your card details, and never asks you to pay into a different account. If "
     "anyone does, contact the centre.", "important")
fig("g22b-overview-upload-proof", "If you close the payment screen before uploading proof, your Overview "
    "reminds you.", [
    "What still needs doing.",
    "<b>Upload proof of payment</b> opens step 3.",
])
fig("g23-pay-upload", "Payment step 3: upload proof.", [
    "The confirmation from your banking app: a screenshot, photo or PDF.",
    "The amount you paid. Also check the date paid.",
    "<b>Submit proof</b>.",
])
fig("g24-overview-checking", "Step 4: the centre checks your payment, usually within one working day.", [
    "What is happening now.",
    "<b>View payment</b> shows what you sent.",
])
note("If the centre can't match your payment (for example the amount doesn't match), you get a message "
     "with the reason and the button changes to <b>Upload new proof</b>.")
fig("g26-overview-enrolled", "Payment confirmed: your child is enrolled and placed in classes.", [
    "The confirmation message.",
])

h2("1.7 Timetable and online classes")
fig("g27-timetable-join", "Your children's upcoming classes.", [
    "Online classes show a <b>Join</b> link instead of a room.",
    "Classes at the centre show the room.",
])
fig("g28-join-not-open", "The join page. Always join through this page, not a link someone forwarded.", [
    "Which class this is. Tap <b>Join as Amahle</b> to go to the meeting (Google Meet, Zoom or Teams).",
])
bullets(
    "The link opens <b>15 minutes before</b> the class starts and closes when it ends.",
    "Joining tells the tutor your child is there. The tutor still confirms the register at the end of class, "
    "so make sure your child stays for the whole lesson.",
    "If you have more than one child in the class, you are asked who is joining.",
    "Hybrid classes (some at the centre, some online) work the same way for those joining online.",
)

h2("1.8 My learners: details and safety")
fig("g29-my-learners", "My learners lists every child on your account.", [
    "<b>Enrol another child</b> starts a new application.",
    "<b>Edit details</b> opens your child's page.",
])
p("On your child's page you can update their details, their emergency contacts, who may collect them and "
  "whether they may leave on their own.")
fig("g30-learner-collectors", "Who may collect your child.", [
    "Everyone listed here may collect your child, as well as you.",
    "Each person shows their relationship and phone. Tap <b>Remove</b> to take someone off.",
    "To add someone, fill in their name, relationship, phone and the last 4 digits of their ID, then tap "
    "<b>Add person</b>.",
])
fig("g31-learner-leave-alone", "Leaving the centre on their own.", [
    "By default your child must be collected.",
    "Tap <b>Allow … to leave on their own</b> if your child may walk home or take transport alone. Only a "
    "parent or guardian can change this, and we record who did and when.",
])
note("If someone who is <b>not</b> on the list arrives to collect your child, staff will not release your "
     "child. They will phone you first. Keep the list and your phone number up to date.", "important")

h2("1.9 Attendance and notifications")
fig("g33-attendance-door", "Attendance shows every session, with arrival and departure times for classes "
    "at the centre.", [
    "<b>At the centre:</b> when your child was signed in and out, and who collected them.",
    "The register status: <b>Present</b>, <b>Late</b> (more than 10 minutes after the start), <b>Absent</b> "
    "or <b>Excused</b>.",
])
fig("g34-notification-signed-out", "You get a notification whenever your child is signed out.", [
    "Who collected your child, and when. Tap the bell at the top of any page to see notifications.",
])
p("If your child is still signed in <b>30 minutes after their class ends</b>, you and the centre get a "
  "\"still at the centre\" notification.")

h2("1.10 Reports, fees, messages and resources")
fig("g36-menu", "On a phone, everything is in the menu behind ☰.", [
    "<b>Fees &amp; statement</b>: invoices, payments and your balance.",
    "<b>Messages</b>: write to the centre or your child's tutor.",
])
fig("g37-progress", "Progress reports: at the end of each term, for each subject, what is going well, what "
    "needs work and what the tutor will do. You can reply to let the centre know you have read it.")
fig("g38-statement-family", "Fees &amp; statement: what you owe, every invoice and a statement of account.")
p("Monthly invoices are issued on the <b>15th</b> for the month ahead and are due on the <b>1st</b>. Pay "
  "each one with PayShap in the same way as the first invoice.")
fig("g40-messages", "Messages.", [
    "Choose who to write to: <b>The centre</b> (the office), or one of your children's tutors. You can also "
    "say which child it is about.",
])
fig("g41-resources", "Resources: worksheets and study material your child's tutor has shared.")

# ---------------------------------------------------------------------------------------------
# Part 2: Learner
# ---------------------------------------------------------------------------------------------

part("Part 2", "Learners", "Amahle takes the test; Neo uses his portal",
     "What a learner sees: the aptitude test when they apply, and their own portal if the centre gives them "
     "a login.")

h2("2.1 The aptitude test")
p("Your grown-up starts the test for you after sending your application. There are 25 questions about "
  "reading and puzzles, and it takes about 20 minutes.")
fig("g16-test-question", "A reading question.", [
    "Read the story at the top, then tap the answer you think is right.",
    "Tap <b>Next</b>. You can't go back, so take your time.",
])
bullets(
    "It's not a pass or fail test. Some questions get harder as you go, and that's fine.",
    "You can stop and carry on later. Your answers are saved.",
    "When you finish, hand the device back to your grown-up.",
)

h2("2.2 Your own login")
p("Older learners can get their own login. Ask the centre: an administrator sets it up and you receive an "
  "email to choose a password. Your portal shows only your own classes, reports and messages. It never "
  "shows fees, or anything about brothers or sisters.")
fig("l01-overview", "Your Overview: your next classes.")
fig("l02-timetable", "My timetable: where each class is, or the <b>Join</b> link for online classes.")
fig("l03-reports", "My reports: your term reports, once your tutor has published them.")
fig("l05-messages", "Messages from your tutor or the centre appear here.")

# ---------------------------------------------------------------------------------------------
# Part 3: Tutor
# ---------------------------------------------------------------------------------------------

part("Part 3", "Tutors", "Johan runs the door and keeps the register",
     "Your classes, the door at the start and end of class, the attendance register, assessments and "
     "reports.")

h2("3.1 Getting started")
p("The centre adds you as a tutor. You receive an email with a link to set your password. Sign in at the "
  "same address as parents; you land in the <b>Tutor workspace</b>.")
fig("t01-overview", "Your Overview: your classes, learners and sessions, and the next seven days.", [
    "The menu. <b>Attendance register</b> is where you sign learners in and out and mark attendance.",
])
fig("t02-schedule", "My schedule: every session over the next month. Online classes show the meeting link.")

h2("3.2 At the door (classes at the centre)")
p("Use your phone at the entrance. Open <b>Attendance register</b> and choose today's session; the "
  "<b>At the door</b> card lists every learner placed in the class.")
fig("t10-door-not-arrived", "Before the learner arrives.", [
    "<b>Not arrived</b>.",
    "Tap <b>Sign in</b> when they arrive. This also marks the register: <b>Present</b>, or <b>Late</b> if it "
    "is more than 10 minutes after the start. It never overwrites <b>Excused</b>.",
])
fig("t11-door-in-centre", "The learner is in the centre.", [
    "The time they arrived.",
    "Tap <b>Sign out</b> when someone comes to collect them.",
])
fig("t12-door-collector", "Who is collecting?", [
    "Only the people listed may collect: the child's parents and guardians, and the people the parent has "
    "authorised.",
    "Choose the person in front of you. For an authorised collector, the screen shows <b>Check their ID "
    "ends in …</b>: ask for their ID and check it. Then tap <b>Sign out</b>.",
    "<b>Someone else is here</b> if the person is not on the list.",
])
note("<b>Left on their own</b> only appears if a parent has allowed this child to leave alone.", "staff")
fig("t13-door-refuse", "Someone who is not on the list.", [
    "Do <b>not</b> release the child.",
    "Call a parent using the number shown. If the parent agrees, an administrator can add the person to the "
    "child's list; the door then lets you sign the child out to them.",
])
fig("t14-door-gone-home", "Signed out. The parent gets a notification straight away.", [
    "Arrival and departure times, and who collected the child.",
    "<b>Undo sign-out</b> is available for 10 minutes if you made a mistake.",
])
note("Anyone still signed in 30 minutes after their class ends triggers a \"still at the centre\" alert "
     "to the administrators and the child's parents. Always sign learners out.", "important")

h2("3.3 The attendance register")
fig("t03-register-in-centre", "The register for a class at the centre.", [
    "Choose a session. The register opens on the most recent one, and you can't mark a session that hasn't "
    "happened yet or was cancelled.",
    "The door card for today's in-centre classes. Below it, mark anyone who didn't come as <b>Absent</b> or "
    "<b>Excused</b>.",
])
fig("t15-register-after-door", "After signing in at the door, the register is already marked.")
p("Parents see the register the same day.")

h2("3.4 Online and hybrid classes")
p("Parents and learners join through a Skolopals <b>Join</b> link, which records who opened it. At the end "
  "of the class, check the list against who was really in the call and confirm the register.")
fig("t04-register-online", "The register for an online class.", [
    "The meeting link, to start the class.",
    "Who opened the join link, and when (or <b>Didn't open the link</b>).",
    "A suggested status for each learner. Change any line that's wrong. Opening the link only shows that "
    "the learner opened it, not that they stayed.",
    "<b>Confirm register</b> saves every line at once.",
])

h2("3.5 Learners, assessments and reports")
fig("t05-learners", "My learners: everyone placed in your classes, with their grade and classes. You see "
    "their academic record, not their family's fees.")
fig("t06-assessments", "Assessments: record an initial assessment, then monthly monitoring. Leave a row "
    "blank if it wasn't assessed (blank is not the same as zero).")
fig("t07-reports", "Progress reports: write each learner's termly report. Saving keeps it as a draft; "
    "parents see nothing until you publish, and publishing can't be undone.")
fig("t08-sessions-taught", "Sessions taught: your sessions and hours each month.")
fig("t09-messages", "Messages from parents and the centre.")
fig("t16-reviews", "Reviews parents have left, once an administrator has published them.")

# ---------------------------------------------------------------------------------------------
# Part 4: Admin
# ---------------------------------------------------------------------------------------------

part("Part 4", "Centre administrators", "Lindiwe runs the centre",
     "Applications, payments, classes, the door, billing and the reports behind the centre. Every menu "
     "item is covered in order.")

h2("4.1 Dashboard")
fig("a01-dashboard", "The centre dashboard.", [
    "The menu. Everything in this part is in the same order.",
    "Learners, tutors and applications waiting for you.",
    "Money: collected, spent, outstanding; plus enquiries and users.",
])

h2("4.2 Users")
fig("a18-users", "Users: everyone with a Skolopals account.", [
    "<b>Add a user</b> sends the person an email to set their password.",
    "Choose their role: Tutor, Parent, Learner, or (super administrators only) Admin.",
    "<b>Edit</b> changes a user's name or roles; <b>Deactivate</b> blocks their login without deleting "
    "anything.",
])
note("Parents normally sign up themselves on the website. Add a tutor here first, then give them their "
     "subjects under <b>Tutors</b>.", "staff")

h2("4.3 Applications")
fig("a02-applications-queue", "Applications, oldest first.", [
    "The tabs: <b>To review</b> (report card and test done), <b>Not finished</b>, <b>Awaiting payment</b>, "
    "<b>Needs placement</b> and <b>Declined</b>.",
    "Open an application.",
])
fig("a03-application-detail", "The application: the learner, what the family asked for, and the report "
    "card (open it with the link under the preview).")
fig("a04-application-decision", "The test result, classes with seats, and your decision.", [
    "(Classes with seats) for each subject, whether a suitable class has room.",
    "<b>Accept</b> raises the first invoice and asks the family to pay within 7 days.",
    "<b>Request more information</b> sends the family a message, for example asking for a clearer report.",
    "<b>Decline</b>, with a reason the family will see.",
])
p("Under the test result, <b>Let them take the test again</b> gives the learner a fresh attempt.")
fig("a05-accept-dialog", "Before accepting, you see exactly what the family will be asked to pay.", [
    "<b>Accept and send the invoice</b>.",
])

h2("4.4 Payments")
fig("a07-payments-queue", "Payments: proofs of payment to check, oldest first. A claimed amount that "
    "differs from the balance is flagged.", [
    "Open the family's proof.",
])
fig("a08-payment-proof", "Check the proof against the bank account before verifying.")
steps(
    "Open the proof of payment and check the money is really in the centre's account.",
    "Check the amount and the date, and add the bank reference.",
    "Tap <b>Verify payment</b>, then <b>Yes, verify</b>. For a first invoice the learner is enrolled and "
    "placed in classes straight away, and the family is told.",
    "If you can't find the payment, choose a reason under <b>Reject</b>. The family sees the reason and can "
    "upload new proof.",
)
fig("a09-verify-dialog", "Confirming a payment.", ["<b>Yes, verify</b>."])

h2("4.5 Learners")
fig("a19-learners", "Learners: every learner with their guardians, enrolment and classes.", [
    "Each learner's details.",
    "<b>Manage</b> takes you to their classes on the Timetable.",
])

h2("4.6 Tutors")
fig("a16-tutors", "Tutors.", [
    "<b>Add a tutor</b>: the person must already have an account (add them under Users first).",
    "Open a tutor to see what they teach, their pay and vetting.",
])
fig("a17-tutor-competency", "What a tutor teaches. A tutor can only be given a class for subjects, grades "
    "and languages recorded here.", [
    "The list of what they teach.",
    "Subject.",
    "Grade (add one grade at a time).",
    "The language(s) they teach it in.",
    "<b>Add competency</b>.",
])

h2("4.7 Timetable: classes and placing learners")
fig("a12-add-online-class", "Add a class. Sessions for the whole term are created when you save.", [
    "The class name families will see.",
    "The tutor (they must already teach this subject, in this language, at every grade).",
    "Delivery: <b>At the centre</b> (choose a room), <b>Online</b> or <b>Hybrid</b>.",
    "For online and hybrid classes, the meeting link (Zoom, Teams, Google Meet or any platform).",
    "Choose the days and times, then <b>Create class and generate sessions</b>.",
])
fig("a14-place-learner", "Placing a learner in a class.", [
    "The class.",
    "Choose the learner. Only learners with an active enrolment are offered.",
    "<b>Add learner</b>. Under the list you can also update the meeting link or regenerate sessions.",
])
note("When a payment is verified, the learner is placed automatically where a suitable class has room. "
     "Anyone left over appears under <b>Applications → Needs placement</b>; place them here.", "staff")
fig("a11-needs-placement", "Needs placement.", ["A learner with a subject that has no class yet."])

h2("4.8 Sessions: cancellations and cover")
fig("a20-sessions", "Sessions over the next three weeks, day by day.")
bullets(
    "<b>Cancel session</b> with a reason (for example load-shedding). <b>Tell the families</b> is ticked by "
    "default. A cancelled session can be put back on.",
    "<b>Save cover</b> assigns a substitute tutor. Only tutors recorded for that subject at every grade in "
    "the class's language are offered. The substitute can see the class list from a week before.",
)

h2("4.9 At the door")
fig("a21-door", "At the door: today's classes at the centre, and who is still in the building.")
p("Administrators use the same sign-in and sign-out controls as tutors (see <b>3.2</b>). The <b>Still at "
  "the centre</b> box lists anyone signed in but not out. To let a new person collect a child after a "
  "parent agrees on the phone, add them to the child's collectors from the learner's page.")

h2("4.10 Billing")
fig("a22-billing", "Billing.")
bullets(
    "<b>Run the monthly invoices</b> on the 15th, for the month ahead. Running it twice is safe; nobody is "
    "billed twice.",
    "<b>Apply late fees</b> adds the R150 fee to invoices more than three days past due.",
    "<b>PayShap details</b> are what parents see when they pay. Check them carefully.",
)

h2("4.11 Expenses")
fig("a23-expenses", "Expenses: record every expense so the dashboard's operating surplus is accurate.")

h2("4.12 Enquiries")
fig("a24-enquiries", "Enquiries from the website arrive here. Log phone, WhatsApp and walk-in enquiries "
    "yourself, set the status, and <b>Mark as enrolled</b> when the family joins.")

h2("4.13 Announcements")
fig("a25-announcements", "Send an announcement to all parents, all tutors, everyone, or the families in "
    "one class. It appears in their portal notifications. Below is everything sent, with who has read it.")

h2("4.14 KPIs")
fig("a26-kpis", "Key performance indicators: break-even, revenue, attendance rates and retention by month.")

# ---------------------------------------------------------------------------------------------
# Extras
# ---------------------------------------------------------------------------------------------

part("Extras", "Fees, policies and help", "For everyone", "Fees and billing rules, frequently asked "
     "questions, a glossary and how we look after your information.")

h2("Fees and billing")
table(["Package or service", "Covers", "Fee"], [
    ["Group – 1 subject", "1 subject", "R450 a month"],
    ["Group – 2 subjects", "2 subjects", "R750 a month"],
    ["Group – 3 subjects", "3 subjects", "R950 a month"],
    ["All-subject support", "All subjects", "R1 100 a month"],
    ["Homework assistance", "All subjects", "R500 a month"],
    ["Academic Plus", "All subjects", "R1 250 a month"],
    ["One-on-one", "1 hour", "R180"],
    ["One-on-one", "Block of 4 lessons", "R650"],
    ["Holiday programme", "Per programme", "R350 – R750"],
    ["Registration", "Once off", "R150"],
])
bullets(
    "<b>First payment:</b> the R150 registration fee plus tuition for the rest of the month you join, worked "
    "out by days. It must be paid within <b>7 days</b> of the application being accepted.",
    "<b>Monthly invoices:</b> issued on the 15th for the month ahead, due on the 1st.",
    "<b>Late fee:</b> R150, added when an invoice is more than 3 days overdue.",
    "<b>How to pay:</b> PayShap (preferred), EFT or cash at the centre. We never ask for card details.",
    "<b>Opening hours:</b> Monday to Thursday 13:00–18:00; Friday 13:00–17:00 (tests, catch-up and parent "
    "meetings); Saturday 08:00–13:00.",
)

h2("Frequently asked questions")
faq = [
    ("I didn't get the confirmation email.", "Check your spam or promotions folder. The link expires; sign "
     "in and ask for a new one, or contact the centre."),
    ("I forgot my password.", "Tap <b>Forgot password?</b> on the sign-in page (1.2)."),
    ("My child didn't finish the test.", "Your Overview shows <b>Go to the test</b>. Your child carries on "
     "from where they stopped."),
    ("I paid but forgot the reference.", "Upload the proof anyway and put the date and amount. The centre "
     "will match it."),
    ("My proof of payment was rejected.", "The reason is shown on your Overview. Check it, then tap "
     "<b>Upload new proof</b>."),
    ("What happens if I don't pay within 7 days?", "The offer lapses. Contact the centre; they can accept "
     "the application again with a fresh invoice."),
    ("Someone else needs to collect my child today.", "Add them under <b>My learners → Edit details → "
     "Authorised to collect</b> with the last 4 digits of their ID, before they arrive. Otherwise staff "
     "will phone you and won't release your child until the person is added."),
    ("The Join link says it isn't open.", "It opens 15 minutes before the class. Check the time on your "
     "timetable."),
    ("My child was marked absent but was there.", "Send a message to the tutor or the centre from "
     "<b>Messages</b>."),
    ("How do I enrol a second child?", "<b>My learners → Enrol another child</b>."),
    ("Can my child have their own login?", "Yes, ask the centre (2.2)."),
]
out.append('<dl class="faq">' + "".join(f"<dt>{q}</dt><dd>{a}</dd>" for q, a in faq) + "</dl>")

h2("Glossary")
table(["Word", "Meaning"], [
    ["Aptitude test", "A 20-minute reading and puzzles activity that helps place a learner. Not pass or fail."],
    ["Application", "The six-step form a parent fills in to enrol a child."],
    ["Authorised collector", "Someone other than a parent who may collect a child. Staff check the last 4 "
     "digits of their ID."],
    ["Competency", "A subject, grade and language a tutor is recorded as teaching."],
    ["Excused", "Absent with a good reason the centre accepts."],
    ["Hybrid class", "A class with some learners at the centre and some online. Online learners use the Join "
     "link."],
    ["Join link", "The Skolopals link to an online class. It records that the learner opened it."],
    ["Late", "Arrived more than 10 minutes after the class started."],
    ["Package", "What you pay for each month: a number of subjects, or all subjects."],
    ["PayShap", "Instant payment between South African bank accounts, using a ShapID instead of an account "
     "number."],
    ["Placement", "Putting a learner into a specific class."],
    ["Pro-rata", "Charged only for the days left in the month."],
    ["Register", "The tutor's attendance record for one session."],
    ["ShapID", "The centre's PayShap address, shown when you pay."],
    ["Sign in / sign out", "Recording when a learner arrives at and leaves the centre."],
])

h2("Your information (POPIA)")
p("Skolopals Tutoring Centre is the responsible party for the personal information in the system, under "
  "the Protection of Personal Information Act 4 of 2013. The full privacy notice is on the website "
  "(<b>Privacy</b>, at the bottom of every page).")
bullets(
    "<b>Consent first.</b> We don't register a learner, run the test or place a child in a class without a "
    "parent's consent. Optional consents (photos in marketing, WhatsApp and email updates) never affect a "
    "child's place, and you can withdraw any consent.",
    "<b>Who sees what.</b> You see only your own children. Tutors see their learners' names, grades, "
    "academic records and attendance, never your fees. The centre's administrators see everything needed "
    "to run the centre. Other parents see nothing about your family. The database enforces these limits.",
    "<b>No health information.</b> We don't collect information about health, allergies or medical "
    "conditions. If your child has a need we should know about to keep them safe, tell the centre manager "
    "in person.",
    "<b>Stored outside South Africa.</b> Our systems are hosted in London, United Kingdom, under protection "
    "substantially similar to POPIA.",
    "<b>How long we keep it.</b> Test results, invoices, payments, messages and learner records for 5 years; "
    "enquiries that didn't lead to enrolment for 1 year. Then we delete or anonymise them.",
    "<b>Your rights.</b> Ask what we hold and get a copy; correct or delete anything wrong; object to "
    "processing; opt out of marketing. We respond within 30 days, free of charge.",
)
note("Information Officer: Winnie Thobela · 067 244 7296 · 10 Plumbago Street, Damonsville, Brits. If you "
     "are not satisfied, you may complain to the Information Regulator (South Africa), Woodmead North "
     "Office Park, 54 Maxwell Drive, Woodmead, Johannesburg, 2191 · POPIAComplaints@inforegulator.org.za.",
     "privacy")
note("Keep personal information inside the portals. Don't send screenshots of learner or family details "
     "on WhatsApp, and lock your phone or computer when you walk away from it.", "staff")

# ---------------------------------------------------------------------------------------------
# Assemble
# ---------------------------------------------------------------------------------------------

toc_html = "".join(
    f'<li class="l{lvl}"><a href="#{aid}">{escape(t)}</a></li>' for lvl, t, aid in toc
)

html = f"""<!doctype html><html lang="en-ZA"><head><meta charset="utf-8">
<title>Skolopals User Manual</title>
<style>
@page {{ size: A4; margin: 18mm 16mm 18mm 16mm;
  @top-left {{ content: string(part); font: 600 8pt "Avenir Next", Helvetica, sans-serif; color: #8a7a99; }}
  @top-right {{ content: "Skolopals User Manual"; font: 8pt "Avenir Next", Helvetica, sans-serif; color: #8a7a99; }}
  @bottom-center {{ content: counter(page); font: 600 8pt "Avenir Next", Helvetica, sans-serif; color: #6a1b9a; }} }}
@page cover {{ margin: 0; @top-left {{ content: none }} @top-right {{ content: none }} @bottom-center {{ content: none }} }}
@page partpage {{ @top-left {{ content: none }} @top-right {{ content: none }} }}
:root {{ --magenta: #d81b7a; --plum: #2a1040; --deep: #1a0a28; --purple: #6a1b9a; --sun: #f5c211; --ink: #24103a; --muted: #6b5d78; --line: #e6dcef; --tint: #f7f1fb; }}
body {{ font-family: "Avenir Next", Avenir, Helvetica, sans-serif; font-size: 10pt; line-height: 1.5; color: var(--ink); }}
.cover {{ page: cover; height: 297mm; background: var(--deep); color: #fff; position: relative; overflow: hidden; }}
.cover .band {{ position: absolute; left: 0; right: 0; bottom: 0; height: 22mm; background: linear-gradient(90deg, var(--magenta), var(--purple)); }}
.cover .sun {{ position: absolute; right: -40mm; top: -40mm; width: 140mm; height: 140mm; border-radius: 50%; background: radial-gradient(circle, rgba(245,194,17,.35), rgba(245,194,17,0) 70%); }}
.cover img {{ width: 70mm; margin: 40mm 0 0 22mm; }}
.cover h1 {{ font-size: 40pt; line-height: 1.05; margin: 28mm 22mm 0; font-weight: 800; }}
.cover h1 span {{ color: #ff8cc6; }}
.cover p {{ margin: 8mm 22mm 0; font-size: 13pt; color: #c9b8d9; max-width: 140mm; }}
.cover .meta {{ position: absolute; bottom: 32mm; left: 22mm; font-size: 9pt; color: #c9b8d9; }}
.toc {{ page-break-after: always; }}
.toc h2 {{ margin-top: 0; }}
.toc ul {{ list-style: none; padding: 0; }}
.toc li a {{ color: var(--ink); text-decoration: none; }}
.toc li a::after {{ content: leader('.') target-counter(attr(href), page); color: var(--muted); }}
.toc li.l1 {{ font-weight: 700; margin-top: 3mm; color: var(--purple); }}
.toc li.l1 a {{ color: var(--purple); }}
.toc li.l2 {{ padding-left: 6mm; font-size: 9.5pt; }}
.part {{ page: partpage; page-break-before: always; page-break-after: always; string-set: part content(); background: var(--deep); color: #fff; margin: -18mm -16mm; padding: 70mm 22mm 0; height: 297mm; box-sizing: border-box; }}
.part .part-num {{ color: var(--sun); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; font-size: 11pt; }}
.part h1 {{ font-size: 34pt; margin: 4mm 0 2mm; line-height: 1.1; string-set: part content(); }}
.part .who {{ color: #ff8cc6; font-size: 13pt; margin: 0 0 10mm; }}
.part .lead {{ color: #c9b8d9; font-size: 12pt; max-width: 140mm; }}
h2 {{ color: var(--purple); font-size: 15pt; margin: 9mm 0 3mm; border-bottom: 2px solid var(--line); padding-bottom: 1.5mm; break-after: avoid; }}
h3 {{ font-size: 11pt; margin: 5mm 0 2mm; break-after: avoid; }}
p {{ margin: 0 0 3mm; }}
b {{ font-weight: 700; }}
ul, ol {{ margin: 0 0 3mm; padding-left: 6mm; }}
li {{ margin-bottom: 1mm; }}
ol.steps li::marker {{ color: var(--magenta); font-weight: 800; }}
figure {{ margin: 3mm 0 5mm; break-inside: avoid; }}
figure.phone {{ display: flex; gap: 7mm; align-items: flex-start; }}
figure.phone .shot {{ flex: 0 0 58mm; }}
figure.phone img {{ width: 58mm; max-height: 108mm; object-fit: cover; object-position: top; border-radius: 4mm; border: 1.2mm solid #120619; box-shadow: 0 1mm 3mm rgba(0,0,0,.25); }}
figure.phone figcaption {{ flex: 1; padding-top: 2mm; }}
figure.desk img {{ width: 100%; max-height: 98mm; object-fit: cover; object-position: top left; border-radius: 2mm; border: 0.4mm solid #ccc; box-shadow: 0 1mm 3mm rgba(0,0,0,.18); }}
figure.desk figcaption {{ margin-top: 2.5mm; }}
.cap {{ font-weight: 600; color: var(--ink); margin-bottom: 2mm; }}
ol.callouts {{ list-style: none; padding: 0; margin: 0; }}
ol.callouts li {{ display: flex; gap: 2.5mm; margin-bottom: 2mm; font-size: 9.5pt; }}
.badge {{ flex: 0 0 5.5mm; height: 5.5mm; border-radius: 50%; background: var(--sun); color: var(--deep); font-weight: 800; font-size: 8.5pt; text-align: center; line-height: 5.5mm; }}
.pair {{ display: flex; gap: 8mm; margin: 4mm 0 6mm; break-inside: avoid; }}
.pair figure {{ margin: 0; flex: 1; }}
.pair img {{ width: 58mm; max-height: 95mm; object-fit: cover; object-position: top; border-radius: 4mm; border: 1.2mm solid #120619; }}
.pair figcaption {{ font-size: 9pt; margin-top: 2mm; max-width: 70mm; }}
.note {{ border-left: 1.2mm solid var(--sun); background: #fff9e3; padding: 2.5mm 4mm; margin: 3mm 0 5mm; border-radius: 0 2mm 2mm 0; break-inside: avoid; font-size: 9.5pt; }}
.note.important {{ border-color: var(--magenta); background: #fdeef5; }}
.note.staff {{ border-color: var(--purple); background: var(--tint); }}
.note.privacy {{ border-color: #0b6e4f; background: #ecf8f2; }}
.note strong {{ display: block; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .08em; margin-bottom: .5mm; }}
table {{ width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9.5pt; break-inside: avoid; }}
th {{ text-align: left; background: var(--plum); color: #fff; padding: 2mm 3mm; font-weight: 600; }}
td {{ padding: 2mm 3mm; border-bottom: 0.3mm solid var(--line); vertical-align: top; }}
tr:nth-child(even) td {{ background: var(--tint); }}
.journey {{ display: flex; flex-direction: column; gap: 2mm; margin: 3mm 0; }}
.j {{ display: flex; gap: 4mm; align-items: baseline; padding: 2.5mm 4mm; border-radius: 2mm; border-left: 2mm solid; background: var(--tint); }}
.j b {{ flex: 0 0 22mm; }}
.j.g {{ border-color: var(--magenta); }} .j.l {{ border-color: var(--sun); }} .j.t {{ border-color: #0b6e4f; }} .j.a {{ border-color: var(--purple); }}
.legend {{ font-size: 8.5pt; color: var(--muted); }}
.dot {{ display: inline-block; width: 3mm; height: 3mm; border-radius: 50%; margin: 0 1mm 0 3mm; vertical-align: middle; }}
.dot.g {{ background: var(--magenta); }} .dot.l {{ background: var(--sun); }} .dot.t {{ background: #0b6e4f; }} .dot.a {{ background: var(--purple); }}
dl.faq dt {{ font-weight: 700; margin-top: 3mm; color: var(--purple); break-after: avoid; }}
dl.faq dd {{ margin: 1mm 0 0; }}
.break {{ page-break-after: always; }}
</style></head><body>
<section class="cover"><div class="sun"></div>
  <img src="{LOGO.as_uri()}">
  <h1>User manual<br><span>From enrolment to the door</span></h1>
  <p>For parents and guardians, learners, tutors and centre staff.</p>
  <div class="meta">Skolopals Tutoring Centre · 10 Plumbago Street, Damonsville, Brits · Version 1.0, November 2026</div>
  <div class="band"></div>
</section>
<nav class="toc"><h2>Contents</h2><ul>{toc_html}</ul></nav>
{''.join(out)}
</body></html>"""

(ROOT / "manual.html").write_text(html, encoding="utf-8")
# Homebrew's weasyprint bundles the native libraries the system Python lacks.
subprocess.run(["weasyprint", str(ROOT / "manual.html"), str(ROOT / "Skolopals-User-Manual.pdf")], check=True)
print("wrote", ROOT / "Skolopals-User-Manual.pdf")
