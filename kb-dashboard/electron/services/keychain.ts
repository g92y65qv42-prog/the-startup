import keytar from 'keytar'

const SERVICE = 'com.kb-dashboard'

export async function getToken(account: string): Promise<string | null> {
  return keytar.getPassword(SERVICE, account)
}

export async function setToken(account: string, token: string): Promise<void> {
  await keytar.setPassword(SERVICE, account, token)
}

export async function deleteToken(account: string): Promise<void> {
  await keytar.deletePassword(SERVICE, account)
}
