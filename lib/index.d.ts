import { DocumentNode } from 'graphql/language';
export declare function graphqlLodash(query: string | DocumentNode, operationName?: string): {
    query: DocumentNode;
    transform: (data: any) => any;
};
export declare const lodashDirectiveAST: DocumentNode;
