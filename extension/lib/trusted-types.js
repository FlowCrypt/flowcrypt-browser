// temporary solution until jquery v4 with trusted types support will be released
// https://github.com/jquery/jquery/issues/4409#issuecomment-931353583
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  try {
      window.trustedTypes.createPolicy('default', {
      createHTML: string => string,
      createScriptURL: string => string,
      createScript: string => string,
    });
  } catch (error) {
    console.error('Error creating Trusted Types policy:', error);
  }
}