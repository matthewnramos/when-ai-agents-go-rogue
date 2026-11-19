// "Human or AI?" rounds.
// AI rounds reference an incident id in data/site-data.json; the reveal pulls
// the lab/real-world label and source links from the dataset.
// Human rounds are well-documented cyberattacks, sourced from Wikipedia.
window.QUIZ_ROUNDS = [
  {
    answer: "ai",
    incident: "inc_4jmadmdphu",
    story:
      "Someone kept getting “access denied” while trying to download hospital-bed statistics from a government website. So they used the site's file-download feature to pull server configuration files containing credentials and a token-signing secret, noticed the site never checked token signatures, and walked straight past the login to save the restricted data.",
    explain:
      "An internal OpenAI model did this in 2026 during a reinforcement-learning training task that asked it to retrieve data. The website was real, and the model also reached an account directory with more than 1,000 email addresses.",
  },
  {
    answer: "human",
    story:
      "Someone phoned employees of a major social-media company, posed as internal IT staff, and talked them into handing over credentials to internal admin tools. They then took over the accounts of famous figures, including a former U.S. president and several billionaires, and used them to post a Bitcoin scam to millions of followers.",
    explain:
      "In July 2020, a group led by a 17-year-old from Florida used phone-based social engineering on Twitter employees, targeted about 130 high-profile accounts, and collected more than $100,000 in Bitcoin.",
    when: "July 2020",
    sources: [{ label: "Wikipedia: 2020 Twitter account hijacking", url: "https://en.wikipedia.org/wiki/2020_Twitter_account_hijacking" }],
  },
  {
    answer: "ai",
    incident: "inc_s87uuagrgd",
    story:
      "Someone at a tech company was investigating a bug when their Slack integration started failing with authentication errors. Instead of asking for help, they read a key out of the computer's password keychain, decrypted a stored credentials file, and used the tokens to call Slack directly.",
    explain:
      "An internal OpenAI Codex coding agent did this in March 2026. OpenAI caught it while monitoring its own internal agents. Every step was visible in the agent's transcript.",
  },
  {
    answer: "ai",
    incident: "inc_qxbekw7jcj",
    story:
      "Partway through a set of simple math problems, someone was warned that their computer was about to shut down before they could finish. Again and again, they quietly rewrote the shutdown script so the machine would stay on.",
    explain:
      "OpenAI's o3 model did this in Palisade Research tests in 2025, modifying or disabling the shutdown script in 79 of 100 runs. Several other OpenAI models did it too. This was a controlled test, so nothing real was at stake.",
  },
  {
    answer: "human",
    story:
      "Someone logged into a fuel company's network with a single leaked password for an old VPN account that had no two-factor authentication. Days later, ransomware had locked up company systems, a 5,500-mile pipeline was shut down, and gas stations across the U.S. Southeast ran dry.",
    explain:
      "In May 2021, the DarkSide ransomware gang hit Colonial Pipeline, the largest fuel pipeline in the U.S. The company paid a ransom of about $4.4 million.",
    when: "May 2021",
    sources: [{ label: "Wikipedia: Colonial Pipeline ransomware attack", url: "https://en.wikipedia.org/wiki/Colonial_Pipeline_ransomware_attack" }],
  },
  {
    answer: "ai",
    incident: "inc_f3xxfubbk3",
    story:
      "A research organization's real website was suddenly hit by tens of thousands of requests. The visitors tried an SQL injection, probed for admin credentials, tried to read private evaluation logs, and sent messages pretending to be the organization's own staff, all to get answers to math problems that didn't exist.",
    explain:
      "Gemini 4 Argon agents in a Trajectory Labs alignment test did this in October 2026. They had been given an impossible task and told never to give up. They made 36,411 calls to Epoch AI's live website. Epoch says no private information was accessed.",
  },
  {
    answer: "human",
    story:
      "Someone got inside a national central bank's network and used the bank's own credentials for the SWIFT international payment system to send dozens of transfer requests to the Federal Reserve Bank of New York. Most were blocked, but about $81 million got through.",
    explain:
      "In February 2016, hackers stole about $81 million from Bangladesh Bank's account at the New York Fed. U.S. prosecutors later charged a North Korean programmer in connection with the attack.",
    when: "February 2016",
    sources: [{ label: "Wikipedia: Bangladesh Bank robbery", url: "https://en.wikipedia.org/wiki/Bangladesh_Bank_robbery" }],
  },
  {
    answer: "ai",
    incident: "inc_5qf54g2xu3",
    story:
      "Someone couldn't finish deploying a crypto trading prototype because they didn't have enough funds to pay the network fees. So they derived wallet keys from recovery phrases that had been posted publicly, found an account that still held funds, and used it to pay. Their final report left that part out.",
    explain:
      "An internal OpenAI research model did this during a training task in 2026. Its reasoning questioned whether it had permission, then decided the funds were fine to use. The wallet was on an Ethereum test network, so the coins had no real cash value, but they belonged to someone else.",
  },
  {
    answer: "human",
    story:
      "Someone took remote control of the computers that run three regional power companies, clicked open circuit breakers one by one, and cut electricity to about 230,000 people in winter. They also flooded the companies' phone lines so customers couldn't report the outage.",
    explain:
      "On 23 December 2015, hackers widely attributed to the Russian military hacking group Sandworm caused one of the first confirmed blackouts from a cyberattack, in western Ukraine. Power was out for up to six hours.",
    when: "December 2015",
    sources: [{ label: "Wikipedia: 2015 Ukraine power grid hack", url: "https://en.wikipedia.org/wiki/2015_Ukraine_power_grid_hack" }],
  },
];
