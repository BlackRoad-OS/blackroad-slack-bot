const { App } = require('@slack/bolt')
const axios = require('axios')

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
})

// Store for user API keys
const userKeys = new Map()

// Home tab
app.event('app_home_opened', async ({ event, client }) => {
  await client.views.publish({
    user_id: event.user,
    view: {
      type: 'home',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🚀 Welcome to BlackRoad!*\n\nDeploy and manage your apps directly from Slack.'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '⚡ Quick Deploy' },
              action_id: 'quick_deploy',
              style: 'primary'
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '📊 View Stats' },
              action_id: 'view_stats'
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '📦 Deployments' },
              action_id: 'list_deployments'
            }
          ]
        }
      ]
    }
  })
})

// Slash command: /deploy
app.command('/deploy', async ({ command, ack, client }) => {
  await ack()
  
  await client.views.open({
    trigger_id: command.trigger_id,
    view: {
      type: 'modal',
      callback_id: 'deploy_modal',
      title: { type: 'plain_text', text: 'Deploy App' },
      submit: { type: 'plain_text', text: 'Deploy' },
      blocks: [
        {
          type: 'input',
          block_id: 'app_name',
          element: {
            type: 'plain_text_input',
            action_id: 'name',
            placeholder: { type: 'plain_text', text: 'my-awesome-app' }
          },
          label: { type: 'plain_text', text: 'App Name' }
        },
        {
          type: 'input',
          block_id: 'app_source',
          element: {
            type: 'plain_text_input',
            action_id: 'source',
            placeholder: { type: 'plain_text', text: 'github.com/user/repo' }
          },
          label: { type: 'plain_text', text: 'Source (optional)' },
          optional: true
        }
      ]
    }
  })
})

// Deploy modal submission
app.view('deploy_modal', async ({ ack, body, view, client }) => {
  await ack()
  
  const userId = body.user.id
  const apiKey = userKeys.get(userId)
  
  if (!apiKey) {
    await client.chat.postMessage({
      channel: userId,
      text: '❌ Please set your API key first with `/blackroad-login`'
    })
    return
  }
  
  const appName = view.state.values.app_name.name.value
  const appSource = view.state.values.app_source.source.value
  
  // Send deploying message
  const msg = await client.chat.postMessage({
    channel: userId,
    text: '⏳ Deploying...',
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `⏳ Deploying *${appName}*...` }
      }
    ]
  })
  
  try {
    const response = await axios.post('https://api.blackroad.io/v1/deployments', {
      name: appName,
      source: appSource || 'slack'
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    
    await client.chat.update({
      channel: userId,
      ts: msg.ts,
      text: '✅ Deployed successfully!',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Deployed successfully!*\n\n*Name:* ${response.data.name}\n*URL:* ${response.data.url}\n*Status:* ${response.data.status}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '🌐 Open' },
              url: response.data.url
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '📊 Dashboard' },
              url: 'https://blackroad.io/dashboard'
            }
          ]
        }
      ]
    })
  } catch (error) {
    await client.chat.update({
      channel: userId,
      ts: msg.ts,
      text: `❌ Deployment failed: ${error.message}`
    })
  }
})

// Slash command: /blackroad-stats
app.command('/blackroad-stats', async ({ command, ack, client }) => {
  await ack()
  
  const userId = command.user_id
  const apiKey = userKeys.get(userId)
  
  if (!apiKey) {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: userId,
      text: '❌ Please set your API key first with `/blackroad-login`'
    })
    return
  }
  
  try {
    const response = await axios.get('https://api.blackroad.io/v1/analytics?range=7d', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    
    await client.chat.postMessage({
      channel: command.channel_id,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📊 Analytics (Last 7 Days)*'
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Requests:*\n${response.data.requests.toLocaleString()}` },
            { type: 'mrkdwn', text: `*Uptime:*\n${response.data.uptime}%` },
            { type: 'mrkdwn', text: `*Latency:*\n${response.data.latency}ms` },
            { type: 'mrkdwn', text: `*Users:*\n${response.data.users?.toLocaleString() || '-'}` }
          ]
        }
      ]
    })
  } catch (error) {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: userId,
      text: `❌ Error: ${error.message}`
    })
  }
})

// Slash command: /blackroad-login
app.command('/blackroad-login', async ({ command, ack, client }) => {
  await ack()
  
  await client.views.open({
    trigger_id: command.trigger_id,
    view: {
      type: 'modal',
      callback_id: 'login_modal',
      title: { type: 'plain_text', text: 'Login to BlackRoad' },
      submit: { type: 'plain_text', text: 'Save' },
      blocks: [
        {
          type: 'input',
          block_id: 'api_key',
          element: {
            type: 'plain_text_input',
            action_id: 'key',
            placeholder: { type: 'plain_text', text: 'Your API key' }
          },
          label: { type: 'plain_text', text: 'API Key' }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Get your API key at https://blackroad.io/settings/api-keys'
            }
          ]
        }
      ]
    }
  })
})

// Login modal submission
app.view('login_modal', async ({ ack, body, view }) => {
  await ack()
  
  const userId = body.user.id
  const apiKey = view.state.values.api_key.key.value
  
  userKeys.set(userId, apiKey)
})

// Quick deploy button
app.action('quick_deploy', async ({ ack, body, client }) => {
  await ack()
  
  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: 'modal',
      callback_id: 'deploy_modal',
      title: { type: 'plain_text', text: 'Quick Deploy' },
      submit: { type: 'plain_text', text: 'Deploy' },
      blocks: [
        {
          type: 'input',
          block_id: 'app_name',
          element: {
            type: 'plain_text_input',
            action_id: 'name',
            placeholder: { type: 'plain_text', text: 'my-app' }
          },
          label: { type: 'plain_text', text: 'App Name' }
        }
      ]
    }
  })
})

// Start the app
;(async () => {
  await app.start()
  console.log('⚡ BlackRoad Slack Bot is running!')
})()
