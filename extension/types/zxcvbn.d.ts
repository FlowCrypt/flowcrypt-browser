// the shape of the result returned by zxcvbn
interface ZxcvbnFeedback {
  warning: string;
  suggestions: string[];
}

type Score = 0 | 1 | 2 | 3 | 4;
interface ZxcvbnResult {
  score: Score;
  password: string;
  guesses: number;
  guessesLog10: number;
  calcTime: number;
}

// options for customizing zxcvbn
interface ZxcvbnOptions {
  translations: Record<string, string>;
  graphs: Record<string, string>;
  dictionary: Record<string, string[]>;
}

declare var zxcvbnts: {
  core: {
    // the main function
    zxcvbn(password: string, userInputs?: string[]): ZxcvbnResult;
    zxcvbnOptions: {
      setOptions(opts: ZxcvbnOptions): void;
    };
  };
  'language-common': {
    translations: Record<string, string>;
    adjacencyGraphs: Record<string, string>;
    dictionary: Record<string, string[]>;
  };
  'language-en': {
    translations: Record<string, string>;
    dictionary: Record<string, string[]>;
  };
};
