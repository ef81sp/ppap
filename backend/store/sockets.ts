import { UsersSockets, UserToken } from "../../backend/type.ts"

const usersSockets: UsersSockets = new Map()
export const getSocket = (userToken: UserToken) => usersSockets.get(userToken)
export const addSocket = (userToken: UserToken, socket: WebSocket) => {
  usersSockets.set(userToken, socket)
}
export const deleteSocket = (userToken: UserToken) => {
  if (usersSockets.delete(userToken)) console.log("deleted: ", userToken)
}
