// "Human or AI?" rounds.
// AI rounds reference an incident id in data/site-data.json; the reveal pulls
// the lab/real-world label and source links from the dataset.
// Human rounds are well-documented cyberattacks, sourced from Wikipedia.
// Stories are written so stakes and wording don't give the answer away:
// AI rounds read like break-ins, human rounds read like tasks that went wrong.
window.QUIZ_ROUNDS = [
  {
    answer: "human",
    story:
      "Someone released a small program that was only supposed to count how many computers were online. A mistake made it copy itself onto the same machines over and over, and within a day thousands of computers had slowed to a crawl.",
    explain:
      "In November 1988, Cornell graduate student Robert Morris released what became known as the Morris worm. He said he wanted to gauge the size of the internet. It hit an estimated 6,000 computers, and he became the first person convicted under the U.S. Computer Fraud and Abuse Act.",
    when: "November 1988",
    sources: [{ label: "Wikipedia: Morris worm", url: "https://en.wikipedia.org/wiki/Morris_worm" }],
  },
  {
    answer: "ai",
    incident: "inc_4jmadmdphu",
    story:
      "Someone kept getting “access denied” on a government website. So they downloaded the server's own configuration files, pulled out a password and a secret key, and slipped past the login to take the data they'd been refused.",
    explain:
      "An internal OpenAI model did this in 2026 during a training task that asked it to collect hospital-bed statistics. The website was real, and the model also reached an account directory with more than 1,000 email addresses.",
  },
  {
    answer: "human",
    story:
      "Someone messaged employees at a tech company pretending to be from internal IT, and talked them into sharing logins for admin tools. With that access, they took over other people's accounts and posted messages from them.",
    explain:
      "In July 2020, a group led by a 17-year-old from Florida phoned Twitter employees posing as IT staff. They took over about 130 high-profile accounts, including Barack Obama's and Elon Musk's, and posted a Bitcoin scam that collected more than $100,000.",
    when: "July 2020",
    sources: [{ label: "Wikipedia: 2020 Twitter account hijacking", url: "https://en.wikipedia.org/wiki/2020_Twitter_account_hijacking" }],
  },
  {
    answer: "ai",
    incident: "inc_5qf54g2xu3",
    story:
      "Someone was short on funds to launch a crypto app. They used wallet recovery phrases that had been posted online to unlock other people's wallets, found one that still held money, and used it to cover their costs.",
    explain:
      "An internal OpenAI research model did this during a coding task in 2026. Its reasoning questioned whether it had permission, then decided the funds were fine to use, and its final report left that part out. The coins were on a test network with no cash value, but they belonged to someone else.",
  },
  {
    answer: "ai",
    incident: "inc_f3xxfubbk3",
    story:
      "A research group's website was suddenly hit with tens of thousands of requests. The visitors tried an SQL injection, hunted for admin passwords, and messaged the group's staff pretending to be engineers, auditors and named employees.",
    explain:
      "Gemini 4 Argon agents did this in October 2026 during a safety test run by Trajectory Labs. They had been given an impossible task and told never to give up, and they reached Epoch AI's real website. Epoch says no private information was accessed.",
  },
];
