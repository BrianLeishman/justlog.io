package dynamo

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func hashKey(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func apikeyLookupPK(hash string) string {
	return "apikey#" + hash
}

// CreateAPIKey generates a new API key for the user, replacing any existing one.
// Returns the raw key (only time it's available).
func CreateAPIKey(ctx context.Context, uid string) (string, error) {
	c, err := client()
	if err != nil {
		return "", err
	}

	// Delete old key first if one exists
	_ = DeleteAPIKey(ctx, uid)

	// Generate random key
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate key: %w", err)
	}
	rawKey := hex.EncodeToString(b)
	hash := hashKey(rawKey)
	lookupPK := apikeyLookupPK(hash)

	_, err = c.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			{
				Put: &types.Put{
					TableName: aws.String(TableName),
					Item: map[string]types.AttributeValue{
						"uid":     &types.AttributeValueMemberS{Value: uid},
						"sk":      &types.AttributeValueMemberS{Value: "apikey"},
						"KeyHash": &types.AttributeValueMemberS{Value: hash},
					},
				},
			},
			{
				Put: &types.Put{
					TableName: aws.String(TableName),
					Item: map[string]types.AttributeValue{
						"uid": &types.AttributeValueMemberS{Value: lookupPK},
						"sk":  &types.AttributeValueMemberS{Value: lookupPK},
						"UID": &types.AttributeValueMemberS{Value: uid},
					},
				},
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("write api key: %w", err)
	}

	return rawKey, nil
}

// LookupAPIKey finds the user ID for a raw API key.
func LookupAPIKey(ctx context.Context, rawKey string) (string, error) {
	c, err := client()
	if err != nil {
		return "", err
	}

	hash := hashKey(rawKey)
	lookupPK := apikeyLookupPK(hash)

	out, err := c.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(TableName),
		Key: map[string]types.AttributeValue{
			"uid": &types.AttributeValueMemberS{Value: lookupPK},
			"sk":  &types.AttributeValueMemberS{Value: lookupPK},
		},
		ProjectionExpression: aws.String("UID"),
	})
	if err != nil {
		return "", fmt.Errorf("lookup api key: %w", err)
	}
	if out.Item == nil {
		return "", fmt.Errorf("api key not found")
	}

	uid, ok := out.Item["UID"].(*types.AttributeValueMemberS)
	if !ok {
		return "", fmt.Errorf("invalid api key record")
	}
	return uid.Value, nil
}

// DeleteAPIKey revokes the API key for a user.
func DeleteAPIKey(ctx context.Context, uid string) error {
	c, err := client()
	if err != nil {
		return err
	}

	// First, get the current key hash so we can delete the lookup item
	out, err := c.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(TableName),
		Key: map[string]types.AttributeValue{
			"uid": &types.AttributeValueMemberS{Value: uid},
			"sk":  &types.AttributeValueMemberS{Value: "apikey"},
		},
		ProjectionExpression: aws.String("KeyHash"),
	})
	if err != nil {
		return fmt.Errorf("get existing key: %w", err)
	}
	if out.Item == nil {
		return nil // no key to delete
	}

	hash, ok := out.Item["KeyHash"].(*types.AttributeValueMemberS)
	if !ok {
		return nil
	}
	lookupPK := apikeyLookupPK(hash.Value)

	_, err = c.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			{
				Delete: &types.Delete{
					TableName: aws.String(TableName),
					Key: map[string]types.AttributeValue{
						"uid": &types.AttributeValueMemberS{Value: uid},
						"sk":  &types.AttributeValueMemberS{Value: "apikey"},
					},
				},
			},
			{
				Delete: &types.Delete{
					TableName: aws.String(TableName),
					Key: map[string]types.AttributeValue{
						"uid": &types.AttributeValueMemberS{Value: lookupPK},
						"sk":  &types.AttributeValueMemberS{Value: lookupPK},
					},
				},
			},
		},
	})
	if err != nil {
		return fmt.Errorf("delete api key: %w", err)
	}
	return nil
}
