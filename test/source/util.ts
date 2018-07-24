
export class Util {

  public static sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

  public static random = () => Math.random().toString(36).substring(7);

}
