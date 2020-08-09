// Require the Bolt package (github.com/slackapi/bolt)
const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

function getArgsFromStr(str) {
  return str.split("; ");
}

async function userIsAdmin(user, context) {
  return await app.client.users.info({
    token: context.botToken,
    user: user
  })
  .is_admin;
}

// Obtain all the users in the workspace as a Map indexed by user id
async function getUsers(context) {
  let users = new Map();
  let cursor = "";
  let result;
  

  do {
    result = await app.client.users.list({
      token: context.botToken,
      cursor: cursor,
      limit: 200
    })
    .catch(exception => {throw exception;});
    
    // console.log(result);

    result.members.forEach((user) => {
      users.set(user.id, user);
    });
    
    cursor = result.response_metadata.next_cursor;
  }
  while(cursor.length > 0)
    
  return users;  
}

async function getUsersByChannel(channel_name, context) {
  let target_channel = undefined;
  let cursor = "";
  let result;
  
  api_call_loop:
  do {
    result = await app.client.conversations.list({
      token: context.botToken,
      cursor: cursor,
      limit: 200,
      types: "public_channel,private_channel"
    })
    .catch(exception => {throw exception});
  
    for (const channel of result.channels) {
      if (channel.name === channel_name) {
          target_channel = channel.id;
          break api_call_loop;
        }
    }
    
    cursor = result.response_metadata.next_cursor;
  }
  while(cursor.length > 0);
  
  if (!target_channel) {
    throw new Error("Could not find channel \"${channel_name}\"");
  }
    
  let users = new Map();
  cursor = "";
    
  do {
    result = await app.client.users.list({
      token: context.botToken,
      cursor: cursor,
      limit: 200
    })
    .catch(exception => {throw exception;});
    
    console.log(result);

    result.members.forEach((user) => {
      users.set(user.id, user);
    });
  }
  while(cursor.length > 0);
  
  return users;
}

// Return a list of DMs the DM_All_Users bot has DMed
async function getDMs(context) {
  let result;
  let dms = [];
  let cursor = ""
  
  do {
    result = await app.client.users.conversations({
      token: context.botToken,
      cursor: cursor,
      limit: 200,
      types: "im"
    })
    .catch(exception => {throw exception});

    result.channels.forEach((dm) => {
        dms.push(dm);
    });
    
    cursor = result.response_metadata.next_cursor;
  }
  while(cursor.length > 0)
    
  // console.log(dms);
    
  return dms;
}

// Send a DM to all users
app.command("/dm_all", async ({ command, ack, respond, context }) => {
  await ack();
  
  if (!userIsAdmin(command.user_id, context)) {
    respond({
      text: "Sorry. You must be an admin to use this command",
      reponse_type: "ephemeral"
    });
    
    return;
  }
  
  // console.log(command);
  // console.log("~" + command.text + "~");
  
  let users = await getUsers(context).catch(ex => {console.error(ex)});
  
  // console.log(users);
    
  users.forEach((user) => {
    app.client.chat.postMessage({
      token: context.botToken,
      channel: user.id,
      text: command.text
    });
  });
});

app.command("/dm_all_in_channel", async ({ command, ack, respond, context }) => {
  await ack();
  
  if (!userIsAdmin(command.user_id, context)) {
    respond({
      text: "Sorry. You must be an admin to use this command",
      reponse_type: "ephemeral"
    });
    
    return;
  }
  
  // console.log(command);
  console.log("command.text");
  
  let args = getArgsFromStr(command.text);
  
  if (args.length != 2) {
    const error_str = "Invalid number of arguments";
    const usage = "`/dm_all_in_channel channel message`";
    
    respond({
      text: error_str + "\n" + usage,
      response_type: "ephemeral"
    })
  }
  
  let users = await getUsersByChannel(args[0], context)
    .catch(ex => {console.error(ex)});
  
  // console.log(users);
    
  users.forEach((user) => {
    app.client.chat.postMessage({
      token: context.botToken,
      channel: user.id,
      text: args[1]
    });
  });
});

// Respond with a list of users the DM_All_Users bot has Dmed
app.command("/dm_all_list", async ({ command, ack, respond, context }) => {
  await ack();
  
  let users = await getUsers(context).catch(ex => {console.error(ex)});
  let dms = await getDMs(context).catch(ex => {console.log(ex)});
  let dms_recipients = "";
  
  dms.forEach(dm => {
    dms_recipients += users.get(dm.user).name + "\n";
  })
  
  dms_recipients = dms_recipients.substring(0, dms_recipients.length);
  await respond(dms_recipients);
  
  // console.log("I'm supposed to say something here.");
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);
})();
  