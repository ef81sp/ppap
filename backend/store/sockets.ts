import { UserToken, UsersSockets } from "../../backend/type.ts"

const usersSockets: UsersSockets = new Map()
export const getSockets = () => usersSockets
export const addSocket = (userToken: UserToken, socket: WebSocket) => {
  usersSockets.set(userToken, socket)
}
export const deleteSocket = (userToken: UserToken) => {
  if (usersSockets.delete(userToken)) console.log("deleted: ", userToken)
}
